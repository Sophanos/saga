# Semantic Search Implementation

> DeepInfra (Qwen3-Embedding-8B + Qwen3-Reranker-4B) + Hetzner Qdrant

This document consolidates the semantic search implementation details, setup instructions, and future roadmap.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Production Setup                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│   │   Supabase      │    │  Hetzner Qdrant │    │   DeepInfra    │  │
│   │   (Metadata)    │    │  78.47.165.136  │    │   (AI Models)  │  │
│   ├─────────────────┤    ├─────────────────┤    ├────────────────┤  │
│   │ • projects      │    │ saga_vectors    │    │ Embedding:     │  │
│   │ • documents     │◄──►│ • doc vectors   │◄──►│ Qwen3-Embed-8B │  │
│   │ • entities      │    │ • entity vectors│    │ 4096 dims      │  │
│   │ • relationships │    │ • HNSW index    │    │ $0.01/M        │  │
│   │ • mentions      │    │                 │    │                │  │
│   │ • analysis      │    │                 │    │ Reranker:      │  │
│   └─────────────────┘    └─────────────────┘    │ Qwen3-Rerank-4B│  │
│                                                  │ $0.025/M       │  │
│                                                  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Document Save → useAutoSave → ai-embed edge fn → DeepInfra → Qdrant upsert
Entity Create → useEntityPersistence → ai-embed edge fn → DeepInfra → Qdrant upsert
Search Query → useSearch → ai-search edge fn → DeepInfra embed → Qdrant search → Rerank
Delete Entity → useEntityPersistence → ai-delete-vector → Qdrant delete
```

---

## Provider Configuration

### DeepInfra Models

| Model | ID | Dimensions | Context | Price |
|-------|-----|------------|---------|-------|
| **Embeddings** | `Qwen/Qwen3-Embedding-8B` | 4096 (native) | 32K | $0.010/M |
| **Reranker** | `Qwen/Qwen3-Reranker-4B` | - | 32K | $0.025/M |

### Why DeepInfra + Qwen3?

- Single provider for embeddings + reranking
- Best-in-class multilingual support (100+ languages)
- 4096 native dimensions for maximum quality
- Competitive pricing ($0.01-0.025/M tokens)
- OpenAI-compatible API
- 32K context window

---

## Environment Variables

### Server-side (Supabase Edge Function Secrets)

Set these via Supabase Dashboard or CLI:

```bash
# Required
DEEPINFRA_API_KEY=your-deepinfra-api-key
QDRANT_URL=http://78.47.165.136:6333

# Optional
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_COLLECTION=saga_vectors  # default: saga_vectors
DEEPINFRA_EMBED_MODEL=Qwen/Qwen3-Embedding-8B  # default
DEEPINFRA_EMBED_DIMENSIONS=4096  # default, native for Qwen3
DEEPINFRA_RERANK_MODEL=Qwen/Qwen3-Reranker-4B  # default
```

### Client-side (`.env.local`)

```bash
# Optional: disable embeddings (enabled by default)
VITE_EMBEDDINGS_ENABLED=false
```

---

## Qdrant Setup

### Server Access

```bash
ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136
```

### Create Collection

```bash
curl -X PUT "http://localhost:6333/collections/saga_vectors" \
  -H "Content-Type: application/json" \
  -H "api-key: your-secure-api-key-here" \
  -d '{
    "vectors": {
      "size": 4096,
      "distance": "Cosine",
      "on_disk": true
    },
    "optimizers_config": {
      "indexing_threshold": 10000
    },
    "hnsw_config": {
      "m": 16,
      "ef_construct": 100
    }
  }'
```

### Collection Schema

```json
{
  "vectors": {
    "size": 4096,
    "distance": "Cosine"
  },
  "payload_schema": {
    "project_id": "keyword",
    "type": "keyword",
    "entity_type": "keyword",
    "title": "text",
    "content_preview": "text",
    "document_id": "keyword",
    "entity_id": "keyword"
  }
}
```

### Verify Setup

```bash
curl -s "http://localhost:6333/collections/saga_vectors" \
  -H "api-key: your-key" | jq

# Expected output:
{
  "result": {
    "status": "green",
    "vectors_count": 0,
    "points_count": 0
  }
}
```

---

## Implementation Files

### Edge Functions (Server-side)

| File | Purpose |
|------|---------|
| `supabase/functions/ai-embed/index.ts` | Embedding generation + Qdrant upsert |
| `supabase/functions/ai-search/index.ts` | Semantic search with reranking |
| `supabase/functions/ai-chat/index.ts` | RAG chat with streaming responses |
| `supabase/functions/ai-delete-vector/index.ts` | Vector deletion |
| `supabase/functions/_shared/deepinfra.ts` | DeepInfra API wrapper |
| `supabase/functions/_shared/qdrant.ts` | Qdrant REST API wrapper |
| `supabase/functions/_shared/prompts/chat.ts` | Chat system prompts |

### Client Libraries

| File | Purpose |
|------|---------|
| `apps/web/src/services/ai/embeddingClient.ts` | Client for ai-embed/ai-delete-vector |
| `apps/web/src/services/ai/searchClient.ts` | Client for ai-search endpoint |
| `apps/web/src/services/ai/chatClient.ts` | Client for ai-chat with SSE streaming |

### Hooks

| File | Purpose |
|------|---------|
| `apps/web/src/hooks/useSearch.ts` | Search orchestration |
| `apps/web/src/hooks/useChatAgent.ts` | RAG chat with streaming and abort |
| `apps/web/src/hooks/useAutoSave.ts` | Auto-indexes documents on save |
| `apps/web/src/hooks/useEntityPersistence.ts` | Auto-indexes/deletes entity vectors |

### UI Components

| File | Purpose |
|------|---------|
| `apps/web/src/components/console/Console.tsx` | ChatPanel with messages UI |
| `apps/web/src/components/console/SearchPanel.tsx` | Semantic search interface |

---

## Usage Guide

### Indexing Documents (Automatic)

Documents are automatically indexed when saved via `useAutoSave`:

```typescript
// Already integrated - documents are indexed after 10s debounce
// Payload includes: project_id, type, document_id, title, content_preview
```

### Indexing Entities (Automatic)

Entities are automatically indexed on create/update via `useEntityPersistence`:

```typescript
const { createEntity, updateEntity, deleteEntity } = useEntityPersistence();

// Create - automatically generates embedding and indexes to Qdrant
await createEntity(newEntity, projectId);

// Update - re-indexes with new content
await updateEntity(entityId, { name: "New Name" });

// Delete - automatically removes vector from Qdrant
await deleteEntity(entityId);
```

### Manual Embedding

```typescript
import { embedTextViaEdge } from "@/services/ai";

// Generate embedding only
const embedding = await embedTextViaEdge("Your text here");

// Generate and index to Qdrant
await embedTextViaEdge("Your text here", {
  qdrant: {
    enabled: true,
    pointId: "unique_id",
    payload: { project_id: "...", type: "document", ... }
  }
});
```

### Semantic Search

```typescript
import { searchViaEdge } from "@/services/ai";

const results = await searchViaEdge({
  query: "What does Kael know about the prophecy?",
  projectId: "your-project-id",
  scope: "all",  // "all" | "documents" | "entities"
  limit: 10,
  rerank: true,  // Enable reranking for better quality
});

// Results include:
// - id, type, title, preview
// - vectorScore (similarity)
// - rerankScore (if rerank=true)
```

---

## Search Flow

```
User Query: "What does Kael know about the prophecy?"
         │
         ▼
┌─────────────────┐
│ Embed Query     │  DeepInfra Qwen3-Embedding-8B
│ Output: 4096d   │  Cost: ~$0.00001
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Qdrant Search   │  Filter: project_id
│ Top 30 results  │  HNSW approximate search
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Rerank (opt)    │  DeepInfra Qwen3-Reranker-4B
│ Top 10 results  │  Cost: ~$0.00005
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return Results  │  id, type, title, preview, scores
└─────────────────┘
```

---

## Cost Estimation

### Per Operation

| Operation | Tokens | Price | Cost |
|-----------|--------|-------|------|
| Embed query | 100 | $0.01/M | $0.000001 |
| Embed document (500 avg) | 500 | $0.01/M | $0.000005 |
| Rerank 30 docs | 6000 | $0.025/M | $0.00015 |
| Search + Rerank | 6100 | - | $0.00016 |

### Per Project (Monthly)

| Usage | Searches | Cost |
|-------|----------|------|
| Light (100/month) | 100 | ~$0.02 |
| Medium (1000/month) | 1000 | ~$0.16 |
| Heavy (10000/month) | 10000 | ~$1.60 |

### Self-hosted vs Cloud

| Component | Self-hosted | Cloud |
|-----------|-------------|-------|
| Qdrant | $0 (Docker on Hetzner) | $50-100/month |
| DeepInfra | $0.01-0.025/M tokens | Same |
| **Total** | ~$1-5/month | $50-100/month |

---

## Security

### Recommended: Cloudflare Tunnel

```bash
# On Hetzner server
cloudflared tunnel create qdrant-tunnel
cloudflared tunnel route dns qdrant-tunnel qdrant.yourdomain.com

cat > /etc/cloudflared/config.yml << EOF
tunnel: qdrant-tunnel
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: qdrant.yourdomain.com
    service: http://localhost:6333
  - service: http_status:404
EOF

systemctl enable cloudflared && systemctl start cloudflared
```

### Alternative: UFW Firewall

```bash
# Only allow from specific IPs
ufw allow from YOUR_IP to any port 6333
```

---

## Future Roadmap

### Phase 1: Enhanced Search (Current)

- [x] Semantic search via Qdrant
- [x] DeepInfra embeddings (4096 dimensions)
- [x] Optional reranking
- [x] Document auto-indexing
- [x] Entity auto-indexing
- [x] Vector deletion on entity removal

### Phase 2: Writing Coach Enhancements

- [ ] Similar passage finder ("You've written something similar in Chapter 3")
- [ ] Tonal consistency detection
- [ ] Character voice consistency checking
- [ ] Genre compliance analysis

### Phase 3: Consistency Linter

- [ ] Cross-document contradiction detection
- [ ] Character knowledge tracking
- [ ] Timeline consistency validation
- [ ] Foreshadowing/payoff matching

### Phase 4: RAG Chat (Complete)

- [x] AI chat with RAG context retrieval (`ai-chat` edge function)
- [x] SSE streaming responses via OpenRouter
- [x] Console Chat tab with message history
- [x] useChatAgent hook with abort support
- [ ] @mentions for explicit context injection
- [ ] Conversation memory across sessions
- [ ] AI answers with citations in Cmd+K

### Phase 5: Advanced Features

- [ ] Hybrid search (semantic + fulltext)
- [ ] Mobile offline embedding sync
- [ ] Auto-generated blurbs and themes
- [ ] Comp title suggestions

---

## Backup & Recovery

### Overview

Qdrant backups are automated via GitHub Actions, running daily at 3:00 AM UTC. Backups are stored in Cloudflare R2 with 7-day retention.

### Backup Script

Located at `muse/scripts/qdrant-backup.sh`, the script:

1. Creates a Qdrant snapshot via REST API
2. Downloads the snapshot locally
3. Uploads to Cloudflare R2 (S3-compatible)
4. Cleans up old snapshots (> 7 days)
5. Removes the snapshot from Qdrant server

### Manual Backup

```bash
# Full backup to R2
QDRANT_URL=http://78.47.165.136:6333 \
QDRANT_API_KEY=your-key \
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com \
R2_ACCESS_KEY_ID=xxx \
R2_SECRET_ACCESS_KEY=xxx \
R2_BUCKET=saga-backups \
./muse/scripts/qdrant-backup.sh

# Snapshot only (no upload)
./muse/scripts/qdrant-backup.sh --snapshot-only

# List existing backups
./muse/scripts/qdrant-backup.sh --list

# Dry run
./muse/scripts/qdrant-backup.sh --dry-run
```

### GitHub Actions Workflow

The workflow at `.github/workflows/qdrant-backup.yml` requires these repository secrets:

| Secret | Description |
|--------|-------------|
| `QDRANT_URL` | Qdrant server URL |
| `QDRANT_API_KEY` | Qdrant API key (if auth enabled) |
| `R2_ENDPOINT` | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET` | R2 bucket name |
| `SLACK_WEBHOOK_URL` | (Optional) Slack notifications |

### Cloudflare R2 Setup

1. Create an R2 bucket in Cloudflare dashboard
2. Create an API token with R2 read/write permissions
3. Note the S3-compatible endpoint URL

```bash
# R2 endpoint format
https://<account-id>.r2.cloudflarestorage.com
```

### Recovery

To restore from a backup:

```bash
# 1. Download the snapshot from R2
aws s3 cp s3://saga-backups/qdrant-backups/saga_vectors_20241229_*.snapshot \
  ./snapshot.snapshot \
  --endpoint-url https://xxx.r2.cloudflarestorage.com

# 2. Upload to Qdrant
curl -X POST "http://QDRANT_URL/collections/saga_vectors/snapshots/upload" \
  -H "api-key: your-key" \
  -H "Content-Type: multipart/form-data" \
  -F "snapshot=@snapshot.snapshot"

# 3. Or recover to a new collection
curl -X PUT "http://QDRANT_URL/collections/saga_vectors_recovered/snapshots/recover" \
  -H "api-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"location": "http://QDRANT_URL/collections/saga_vectors/snapshots/snapshot-name"}'
```

### Backup Retention

| Location | Retention |
|----------|-----------|
| Qdrant Server | Deleted immediately after upload |
| Cloudflare R2 | 7 days (configurable) |
| GitHub Actions Logs | 7 days |

---

## Troubleshooting

### Embeddings Not Working

1. Check `VITE_EMBEDDINGS_ENABLED` is not set to `false`
2. Verify edge function secrets are set in Supabase
3. Check browser console for embedding errors
4. Verify Qdrant is accessible from edge function

### Search Returns No Results

1. Ensure documents have been saved (triggers indexing)
2. Check Qdrant collection has vectors: `curl http://QDRANT_URL/collections/saga_vectors`
3. Verify projectId filter is correct
4. Try lowering the search score threshold

### Vector Dimension Mismatch

If you see dimension errors, ensure:
- Qdrant collection was created with `size: 4096`
- Edge function is using `DEEPINFRA_EMBED_DIMENSIONS=4096` (default)

---

## References

- [DeepInfra Embeddings](https://deepinfra.com/Qwen/Qwen3-Embedding-8B)
- [DeepInfra Reranker](https://deepinfra.com/Qwen/Qwen3-Reranker-4B)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Qwen3 Technical Report](https://qwenlm.github.io/blog/qwen3/)
