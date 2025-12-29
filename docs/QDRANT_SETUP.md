# Qdrant Setup on Hetzner Orchestrator

> **Note:** This document has been consolidated into [SEMANTIC_SEARCH.md](./SEMANTIC_SEARCH.md).
> See that document for the complete, up-to-date implementation guide.

> Using existing Hetzner infrastructure for Mythos/Saga vector storage

---

## Server Access

```bash
ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136
```

---

## 1. Check/Install Qdrant

### Check if Qdrant is Running

```bash
# Check for existing Qdrant
docker ps | grep qdrant
curl -s http://localhost:6333/collections | jq
```

### Install Qdrant (if not present)

```bash
# Create data directory
mkdir -p /opt/qdrant/storage

# Run Qdrant with Docker
docker run -d \
  --name qdrant \
  --restart unless-stopped \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /opt/qdrant/storage:/qdrant/storage \
  -e QDRANT__SERVICE__API_KEY=your-secure-api-key-here \
  qdrant/qdrant:latest

# Verify
curl -s http://localhost:6333/collections | jq
```

### Configure Firewall (UFW)

```bash
# Only allow Qdrant from specific IPs (your dev machine, Vercel, etc.)
ufw allow from YOUR_IP to any port 6333
ufw allow from YOUR_IP to any port 6334

# Or use Cloudflare Tunnel / WireGuard for secure access
```

---

## 2. Create Saga Collection

### Via REST API

```bash
# Create collection for Mythos/Saga
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

# Verify collection
curl -s "http://localhost:6333/collections/saga_vectors" \
  -H "api-key: your-secure-api-key-here" | jq
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
    "document_id": "keyword",
    "entity_id": "keyword"
  }
}
```

---

## 3. Environment Variables

Add to Supabase Edge Function secrets (via Dashboard or CLI):

```bash
# Qdrant Configuration (server-side only)
QDRANT_URL=http://78.47.165.136:6333
QDRANT_API_KEY=your-secure-api-key-here
QDRANT_COLLECTION=saga_vectors

# DeepInfra Configuration (server-side only)
DEEPINFRA_API_KEY=your-deepinfra-api-key
```

For client-side toggle (in `.env.local`):
```bash
# Optional: disable embeddings (enabled by default)
VITE_EMBEDDINGS_ENABLED=false
```

For production (via Cloudflare Tunnel):
```bash
VITE_QDRANT_URL=https://qdrant.yourdomain.com
```

---

## 4. Updated Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Web App)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
           ┌─────────────────┴─────────────────┐
           │                                   │
           ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│   Supabase Cloud    │             │  Hetzner Qdrant     │
│   (Metadata)        │             │  78.47.165.136:6333 │
├─────────────────────┤             ├─────────────────────┤
│ • projects          │             │ Collection:         │
│ • documents         │◄───────────►│ saga_vectors        │
│ • entities          │  (IDs sync) │                     │
│ • relationships     │             │ • document vectors  │
│ • mentions          │             │ • entity vectors    │
│ • analysis          │             │ • HNSW index        │
└─────────────────────┘             └─────────────────────┘
           │                                   │
           └─────────────────┬─────────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │   OpenRouter API    │
                  │   (Embeddings)      │
                  ├─────────────────────┤
                  │ qwen/qwen3-embed-8b │
                  │ $0.01/M tokens      │
                  └─────────────────────┘
```

---

## 5. Qdrant Client Implementation

### Install Package

```bash
cd muse
bun add @qdrant/js-client-rest
```

### Client Setup

**File:** `packages/db/src/clients/qdrant.ts` (NEW)

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = import.meta.env.VITE_QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = import.meta.env.VITE_QDRANT_API_KEY;
const COLLECTION_NAME = import.meta.env.VITE_QDRANT_COLLECTION || "saga_vectors";

let qdrantClient: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
  return qdrantClient;
}

export { COLLECTION_NAME };
```

### Vector Operations

**File:** `packages/db/src/queries/qdrant-vectors.ts` (NEW)

```typescript
import { getQdrantClient, COLLECTION_NAME } from "../clients/qdrant";
import { v4 as uuid } from "uuid";

export type VectorType = "document" | "entity";

export interface VectorPayload {
  project_id: string;
  type: VectorType;
  document_id?: string;
  entity_id?: string;
  entity_type?: string;
  title?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: VectorPayload;
}

/**
 * Upsert document vector
 */
export async function upsertDocumentVector(
  documentId: string,
  projectId: string,
  embedding: number[],
  title?: string
): Promise<void> {
  const client = getQdrantClient();
  
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{
      id: documentId,
      vector: embedding,
      payload: {
        project_id: projectId,
        type: "document",
        document_id: documentId,
        title: title || "",
      },
    }],
  });
}

/**
 * Upsert entity vector
 */
export async function upsertEntityVector(
  entityId: string,
  projectId: string,
  embedding: number[],
  entityType: string,
  name?: string
): Promise<void> {
  const client = getQdrantClient();
  
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{
      id: entityId,
      vector: embedding,
      payload: {
        project_id: projectId,
        type: "entity",
        entity_id: entityId,
        entity_type: entityType,
        title: name || "",
      },
    }],
  });
}

/**
 * Search vectors by similarity
 */
export async function searchVectors(
  projectId: string,
  embedding: number[],
  options?: {
    type?: VectorType;
    entityType?: string;
    limit?: number;
    scoreThreshold?: number;
  }
): Promise<SearchResult[]> {
  const client = getQdrantClient();
  const { type, entityType, limit = 10, scoreThreshold = 0.5 } = options || {};
  
  // Build filter
  const must: any[] = [
    { key: "project_id", match: { value: projectId } },
  ];
  
  if (type) {
    must.push({ key: "type", match: { value: type } });
  }
  
  if (entityType) {
    must.push({ key: "entity_type", match: { value: entityType } });
  }
  
  const results = await client.search(COLLECTION_NAME, {
    vector: embedding,
    limit,
    filter: { must },
    score_threshold: scoreThreshold,
    with_payload: true,
  });
  
  return results.map(r => ({
    id: r.id as string,
    score: r.score,
    payload: r.payload as VectorPayload,
  }));
}

/**
 * Search documents only
 */
export async function searchDocuments(
  projectId: string,
  embedding: number[],
  limit = 10
): Promise<SearchResult[]> {
  return searchVectors(projectId, embedding, { type: "document", limit });
}

/**
 * Search entities only
 */
export async function searchEntities(
  projectId: string,
  embedding: number[],
  limit = 10,
  entityType?: string
): Promise<SearchResult[]> {
  return searchVectors(projectId, embedding, { type: "entity", entityType, limit });
}

/**
 * Delete vector by ID
 */
export async function deleteVector(id: string): Promise<void> {
  const client = getQdrantClient();
  await client.delete(COLLECTION_NAME, {
    wait: true,
    points: [id],
  });
}

/**
 * Delete all vectors for a project
 */
export async function deleteProjectVectors(projectId: string): Promise<void> {
  const client = getQdrantClient();
  await client.delete(COLLECTION_NAME, {
    wait: true,
    filter: {
      must: [{ key: "project_id", match: { value: projectId } }],
    },
  });
}

/**
 * Get collection info
 */
export async function getCollectionInfo(): Promise<{
  vectorsCount: number;
  pointsCount: number;
}> {
  const client = getQdrantClient();
  const info = await client.getCollection(COLLECTION_NAME);
  return {
    vectorsCount: info.vectors_count || 0,
    pointsCount: info.points_count || 0,
  };
}
```

---

## 6. Migration: pgvector → Qdrant

Since we're starting fresh, no migration needed. But if you had existing pgvector data:

```typescript
// scripts/migrate-to-qdrant.ts
import { getSupabaseClient } from "@mythos/db";
import { upsertDocumentVector, upsertEntityVector } from "@mythos/db/qdrant-vectors";

async function migrateToQdrant() {
  const supabase = getSupabaseClient();
  
  // Migrate documents with embeddings
  const { data: docs } = await supabase
    .from("documents")
    .select("id, project_id, title, embedding")
    .not("embedding", "is", null);
  
  for (const doc of docs || []) {
    await upsertDocumentVector(
      doc.id,
      doc.project_id,
      doc.embedding,
      doc.title
    );
    console.log(`Migrated document: ${doc.title}`);
  }
  
  // Migrate entities with embeddings
  const { data: entities } = await supabase
    .from("entities")
    .select("id, project_id, name, type, embedding")
    .not("embedding", "is", null);
  
  for (const entity of entities || []) {
    await upsertEntityVector(
      entity.id,
      entity.project_id,
      entity.embedding,
      entity.type,
      entity.name
    );
    console.log(`Migrated entity: ${entity.name}`);
  }
}
```

---

## 7. Secure Access Options

### Option A: Direct IP (Development)

```bash
# Allow your IP through UFW
ssh root@78.47.165.136 "ufw allow from $(curl -s ifconfig.me) to any port 6333"
```

### Option B: Cloudflare Tunnel (Production)

```bash
# On Hetzner server
cloudflared tunnel create qdrant-tunnel
cloudflared tunnel route dns qdrant-tunnel qdrant.yourdomain.com

# Create config
cat > /etc/cloudflared/config.yml << EOF
tunnel: qdrant-tunnel
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: qdrant.yourdomain.com
    service: http://localhost:6333
  - service: http_status:404
EOF

# Run as service
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

### Option C: WireGuard VPN

```bash
# Already configured? Just use internal IP
VITE_QDRANT_URL=http://10.0.0.1:6333
```

---

## 8. Testing

### Health Check

```bash
# From your machine
curl -s "http://78.47.165.136:6333/collections/saga_vectors" \
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

### Insert Test Vector

```bash
curl -X PUT "http://78.47.165.136:6333/collections/saga_vectors/points" \
  -H "Content-Type: application/json" \
  -H "api-key: your-key" \
  -d '{
    "points": [{
      "id": "test-1",
      "vector": [0.1, 0.2, 0.3, ...],  
      "payload": {
        "project_id": "test",
        "type": "document",
        "title": "Test Document"
      }
    }]
  }'
```

---

## 9. Backup Strategy

```bash
# Cron job for daily backups
cat > /etc/cron.daily/qdrant-backup << 'EOF'
#!/bin/bash
BACKUP_DIR=/opt/qdrant/backups
DATE=$(date +%Y%m%d)

# Create snapshot via API
curl -X POST "http://localhost:6333/collections/saga_vectors/snapshots" \
  -H "api-key: your-key"

# Copy to backup directory
cp /opt/qdrant/storage/collections/saga_vectors/snapshots/* $BACKUP_DIR/

# Keep only last 7 days
find $BACKUP_DIR -mtime +7 -delete
EOF

chmod +x /etc/cron.daily/qdrant-backup
```

---

## 10. Cost Summary

| Component | Cost |
|-----------|------|
| Hetzner (existing) | €0 (already paid) |
| Qdrant (self-hosted) | €0 (Docker) |
| Qwen3 Embeddings | ~$0.01/M tokens |
| **Total** | **~$1-5/month** |

vs Qdrant Cloud: $50-100/month

---

## Next Steps

1. [ ] SSH into Hetzner, check/install Qdrant
2. [ ] Create `saga_vectors` collection
3. [ ] Set up secure access (Cloudflare Tunnel or UFW)
4. [ ] Add environment variables
5. [ ] Implement Qdrant client in codebase
6. [ ] Wire up embedding generation on save
