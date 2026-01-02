#!/bin/bash
# =============================================================================
# Qdrant Backup Script for Saga
# =============================================================================
#
# Creates snapshots of the Qdrant saga_vectors collection and uploads to
# Cloudflare R2 (S3-compatible). Manages retention by cleaning old snapshots.
#
# Prerequisites:
#   - AWS CLI v2 installed (brew install awscli)
#   - jq installed (brew install jq)
#   - curl installed
#
# Required Environment Variables:
#   QDRANT_URL        - Qdrant server URL (e.g., http://78.47.165.136:6333)
#   R2_ENDPOINT       - Cloudflare R2 endpoint (e.g., https://xxx.r2.cloudflarestorage.com)
#   R2_ACCESS_KEY_ID  - R2 access key ID
#   R2_SECRET_ACCESS_KEY - R2 secret access key
#   R2_BUCKET         - R2 bucket name for backups
#
# Optional Environment Variables:
#   QDRANT_API_KEY    - Qdrant API key (if authentication enabled)
#   QDRANT_COLLECTION - Collection name (default: saga_vectors)
#   BACKUP_RETENTION_DAYS - Days to keep backups (default: 7)
#   BACKUP_DIR        - Local backup directory (default: /tmp/qdrant-backups)
#   LOG_LEVEL         - Logging level: debug, info, warn, error (default: info)
#
# Usage:
#   ./qdrant-backup.sh                    # Full backup workflow
#   ./qdrant-backup.sh --snapshot-only    # Create snapshot, no upload
#   ./qdrant-backup.sh --cleanup-only     # Only cleanup old backups
#   ./qdrant-backup.sh --list             # List existing backups in R2
#   ./qdrant-backup.sh --dry-run          # Show what would be done
#
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "$0")"

# Qdrant configuration
QDRANT_URL="${QDRANT_URL:-}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"
QDRANT_COLLECTION="${QDRANT_COLLECTION:-saga_vectors}"

# R2/S3 configuration
R2_ENDPOINT="${R2_ENDPOINT:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET="${R2_BUCKET:-}"
R2_PREFIX="${R2_PREFIX:-qdrant-backups}"

# Backup settings
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/qdrant-backups}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Runtime flags
DRY_RUN=false
SNAPSHOT_ONLY=false
CLEANUP_ONLY=false
LIST_ONLY=false

# Timestamp for this backup run
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DATE_TODAY=$(date -u +"%Y-%m-%d")

# =============================================================================
# Logging
# =============================================================================

declare -A LOG_LEVELS=([debug]=0 [info]=1 [warn]=2 [error]=3)

log() {
    local level="${1}"
    local message="${2}"
    local level_num="${LOG_LEVELS[$level]:-1}"
    local current_level_num="${LOG_LEVELS[$LOG_LEVEL]:-1}"

    if [[ $level_num -ge $current_level_num ]]; then
        local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        local prefix=""
        case "$level" in
            debug) prefix="[DEBUG]" ;;
            info)  prefix="[INFO] " ;;
            warn)  prefix="[WARN] " ;;
            error) prefix="[ERROR]" ;;
        esac
        echo "${timestamp} ${prefix} ${message}" >&2
    fi
}

log_debug() { log "debug" "$1"; }
log_info()  { log "info" "$1"; }
log_warn()  { log "warn" "$1"; }
log_error() { log "error" "$1"; }

# =============================================================================
# Utilities
# =============================================================================

check_dependencies() {
    local missing=()

    command -v curl >/dev/null 2>&1 || missing+=("curl")
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    command -v aws >/dev/null 2>&1 || missing+=("aws (AWS CLI)")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing[*]}"
        log_error "Install with: brew install curl jq awscli"
        exit 1
    fi

    log_debug "All dependencies present"
}

check_required_vars() {
    local mode="$1"
    local missing=()

    # Always need Qdrant URL for snapshot operations
    if [[ "$mode" != "list" && "$mode" != "cleanup" ]]; then
        [[ -z "$QDRANT_URL" ]] && missing+=("QDRANT_URL")
    fi

    # Need R2 config for upload/cleanup/list
    if [[ "$mode" != "snapshot" ]]; then
        [[ -z "$R2_ENDPOINT" ]] && missing+=("R2_ENDPOINT")
        [[ -z "$R2_ACCESS_KEY_ID" ]] && missing+=("R2_ACCESS_KEY_ID")
        [[ -z "$R2_SECRET_ACCESS_KEY" ]] && missing+=("R2_SECRET_ACCESS_KEY")
        [[ -z "$R2_BUCKET" ]] && missing+=("R2_BUCKET")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required environment variables: ${missing[*]}"
        exit 1
    fi

    log_debug "Required environment variables present"
}

setup_aws_env() {
    # Configure AWS CLI for R2
    export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
    export AWS_DEFAULT_REGION="auto"
}

qdrant_headers() {
    local headers=(-H "Content-Type: application/json")
    if [[ -n "$QDRANT_API_KEY" ]]; then
        headers+=(-H "api-key: $QDRANT_API_KEY")
    fi
    echo "${headers[@]}"
}

# =============================================================================
# Qdrant Snapshot Operations
# =============================================================================

check_qdrant_health() {
    log_info "Checking Qdrant health..."

    local response
    local headers
    headers=($(qdrant_headers))

    response=$(curl -sS --max-time 30 "${headers[@]}" \
        "${QDRANT_URL}/collections/${QDRANT_COLLECTION}" 2>&1) || {
        log_error "Failed to connect to Qdrant: $response"
        return 1
    }

    local status
    status=$(echo "$response" | jq -r '.result.status // "unknown"')

    if [[ "$status" != "green" ]]; then
        log_warn "Qdrant collection status is '$status' (expected 'green')"
    fi

    local points_count
    points_count=$(echo "$response" | jq -r '.result.points_count // 0')
    log_info "Collection '$QDRANT_COLLECTION' has $points_count points (status: $status)"

    return 0
}

create_qdrant_snapshot() {
    log_info "Creating Qdrant snapshot for collection '$QDRANT_COLLECTION'..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would create snapshot via POST ${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots"
        echo "dry-run-snapshot-${TIMESTAMP}.snapshot"
        return 0
    fi

    local response
    local headers
    headers=($(qdrant_headers))

    response=$(curl -sS --max-time 300 -X POST "${headers[@]}" \
        "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots" 2>&1) || {
        log_error "Failed to create snapshot: $response"
        return 1
    }

    local snapshot_name
    snapshot_name=$(echo "$response" | jq -r '.result.name // empty')

    if [[ -z "$snapshot_name" ]]; then
        log_error "Snapshot creation failed. Response: $response"
        return 1
    fi

    log_info "Snapshot created: $snapshot_name"
    echo "$snapshot_name"
}

download_snapshot() {
    local snapshot_name="$1"
    local output_path="$2"

    log_info "Downloading snapshot '$snapshot_name'..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would download to $output_path"
        touch "$output_path"
        return 0
    fi

    local headers
    headers=($(qdrant_headers))

    curl -sS --max-time 600 "${headers[@]}" \
        "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${snapshot_name}" \
        -o "$output_path" || {
        log_error "Failed to download snapshot"
        return 1
    }

    local size
    size=$(stat -f%z "$output_path" 2>/dev/null || stat -c%s "$output_path" 2>/dev/null)
    log_info "Downloaded snapshot: $(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo "${size} bytes")"
}

delete_qdrant_snapshot() {
    local snapshot_name="$1"

    log_info "Deleting Qdrant snapshot '$snapshot_name'..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would delete snapshot from Qdrant"
        return 0
    fi

    local headers
    headers=($(qdrant_headers))

    curl -sS --max-time 60 -X DELETE "${headers[@]}" \
        "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${snapshot_name}" >/dev/null || {
        log_warn "Failed to delete Qdrant snapshot (may already be deleted)"
    }
}

list_qdrant_snapshots() {
    log_debug "Listing Qdrant snapshots..."

    local headers
    headers=($(qdrant_headers))

    local response
    response=$(curl -sS --max-time 30 "${headers[@]}" \
        "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots" 2>&1) || {
        log_error "Failed to list snapshots: $response"
        return 1
    }

    echo "$response" | jq -r '.result[].name // empty' 2>/dev/null
}

# =============================================================================
# R2/S3 Operations
# =============================================================================

upload_to_r2() {
    local local_path="$1"
    local remote_key="$2"

    log_info "Uploading to R2: s3://${R2_BUCKET}/${remote_key}"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would upload $local_path to R2"
        return 0
    fi

    aws s3 cp "$local_path" "s3://${R2_BUCKET}/${remote_key}" \
        --endpoint-url "$R2_ENDPOINT" \
        --quiet || {
        log_error "Failed to upload to R2"
        return 1
    }

    log_info "Upload complete"
}

list_r2_backups() {
    log_info "Listing backups in R2..."

    aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/" \
        --endpoint-url "$R2_ENDPOINT" 2>/dev/null || {
        log_warn "No backups found or bucket not accessible"
        return 0
    }
}

cleanup_old_r2_backups() {
    log_info "Cleaning up R2 backups older than $BACKUP_RETENTION_DAYS days..."

    local cutoff_date
    cutoff_date=$(date -u -v-${BACKUP_RETENTION_DAYS}d +"%Y-%m-%d" 2>/dev/null || \
                  date -u -d "-${BACKUP_RETENTION_DAYS} days" +"%Y-%m-%d")

    log_debug "Cutoff date: $cutoff_date"

    # List all backup files
    local backups
    backups=$(aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/" \
        --endpoint-url "$R2_ENDPOINT" 2>/dev/null | awk '{print $4}' | grep '\.snapshot$' || true)

    if [[ -z "$backups" ]]; then
        log_info "No backups to clean up"
        return 0
    fi

    local deleted=0
    while IFS= read -r backup; do
        # Extract date from filename (format: saga_vectors_YYYYMMDD_*.snapshot)
        local backup_date
        backup_date=$(echo "$backup" | grep -oE '[0-9]{8}' | head -1)

        if [[ -n "$backup_date" ]]; then
            local formatted_date="${backup_date:0:4}-${backup_date:4:2}-${backup_date:6:2}"

            if [[ "$formatted_date" < "$cutoff_date" ]]; then
                log_info "Deleting old backup: $backup (date: $formatted_date)"

                if [[ "$DRY_RUN" != "true" ]]; then
                    aws s3 rm "s3://${R2_BUCKET}/${R2_PREFIX}/${backup}" \
                        --endpoint-url "$R2_ENDPOINT" --quiet
                else
                    log_info "[DRY RUN] Would delete $backup"
                fi
                ((deleted++))
            fi
        fi
    done <<< "$backups"

    log_info "Cleaned up $deleted old backup(s)"
}

# =============================================================================
# Main Workflow
# =============================================================================

do_backup() {
    log_info "Starting Qdrant backup workflow..."
    log_info "Collection: $QDRANT_COLLECTION"
    log_info "Retention: $BACKUP_RETENTION_DAYS days"

    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"

    # Check Qdrant health
    check_qdrant_health || exit 1

    # Create snapshot
    local snapshot_name
    snapshot_name=$(create_qdrant_snapshot) || exit 1

    if [[ "$SNAPSHOT_ONLY" == "true" ]]; then
        log_info "Snapshot-only mode: skipping upload and cleanup"
        log_info "Snapshot available at: ${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${snapshot_name}"
        return 0
    fi

    # Download snapshot locally
    local local_file="${BACKUP_DIR}/${QDRANT_COLLECTION}_${TIMESTAMP}_${snapshot_name}"
    download_snapshot "$snapshot_name" "$local_file" || exit 1

    # Upload to R2
    local remote_key="${R2_PREFIX}/${QDRANT_COLLECTION}_$(date -u +%Y%m%d)_${TIMESTAMP}.snapshot"
    setup_aws_env
    upload_to_r2 "$local_file" "$remote_key" || exit 1

    # Cleanup local file
    if [[ "$DRY_RUN" != "true" ]]; then
        rm -f "$local_file"
        log_debug "Removed local file: $local_file"
    fi

    # Delete snapshot from Qdrant (optional, saves disk space on Qdrant server)
    delete_qdrant_snapshot "$snapshot_name"

    # Cleanup old backups in R2
    cleanup_old_r2_backups

    log_info "Backup workflow complete!"
    log_info "Backup location: s3://${R2_BUCKET}/${remote_key}"
}

do_cleanup() {
    log_info "Running cleanup-only mode..."
    setup_aws_env
    cleanup_old_r2_backups
}

do_list() {
    log_info "Listing backups..."
    setup_aws_env
    list_r2_backups
}

# =============================================================================
# CLI
# =============================================================================

usage() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Backup Qdrant saga_vectors collection to Cloudflare R2.

Options:
    --snapshot-only   Create snapshot without uploading to R2
    --cleanup-only    Only cleanup old backups in R2
    --list            List existing backups in R2
    --dry-run         Show what would be done without making changes
    -h, --help        Show this help message

Environment Variables:
    QDRANT_URL              Qdrant server URL (required)
    QDRANT_API_KEY          Qdrant API key (optional)
    QDRANT_COLLECTION       Collection name (default: saga_vectors)
    R2_ENDPOINT             Cloudflare R2 endpoint (required for upload)
    R2_ACCESS_KEY_ID        R2 access key ID (required for upload)
    R2_SECRET_ACCESS_KEY    R2 secret access key (required for upload)
    R2_BUCKET               R2 bucket name (required for upload)
    R2_PREFIX               R2 key prefix (default: qdrant-backups)
    BACKUP_RETENTION_DAYS   Days to keep backups (default: 7)
    LOG_LEVEL               debug, info, warn, error (default: info)

Examples:
    # Full backup
    QDRANT_URL=http://78.47.165.136:6333 \\
    R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com \\
    R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \\
    R2_BUCKET=saga-backups \\
    ./qdrant-backup.sh

    # Dry run
    ./qdrant-backup.sh --dry-run

    # List backups
    ./qdrant-backup.sh --list
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --snapshot-only)
                SNAPSHOT_ONLY=true
                shift
                ;;
            --cleanup-only)
                CLEANUP_ONLY=true
                shift
                ;;
            --list)
                LIST_ONLY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

main() {
    parse_args "$@"

    check_dependencies

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "=== DRY RUN MODE ==="
    fi

    if [[ "$LIST_ONLY" == "true" ]]; then
        check_required_vars "list"
        do_list
    elif [[ "$CLEANUP_ONLY" == "true" ]]; then
        check_required_vars "cleanup"
        do_cleanup
    elif [[ "$SNAPSHOT_ONLY" == "true" ]]; then
        check_required_vars "snapshot"
        do_backup
    else
        check_required_vars "full"
        do_backup
    fi
}

main "$@"
