# Embedding & Vector Search Implementation Plan

> **Note:** This document has been consolidated into [SEMANTIC_SEARCH.md](./SEMANTIC_SEARCH.md).
> See that document for the complete, up-to-date implementation guide.

> DeepInfra (Embeddings + Reranker) + Hetzner Qdrant

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
│   │ • entities      │    │ • entity vectors│    │ $0.01/M        │  │
│   │ • relationships │    │ • HNSW index    │    │                │  │
│   │ • mentions      │    │                 │    │ Reranker:      │  │
│   │ • analysis      │    │                 │    │ Qwen3-Rerank-4B│  │
│   └─────────────────┘    └─────────────────┘    │ $0.025/M       │  │
│                                                  └────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Provider Configuration

### DeepInfra Models

| Model | ID | Dimensions | Context | Price |
|-------|-----|------------|---------|-------|
| **Embeddings** | `Qwen/Qwen3-Embedding-8B` | 32-8192 | 32K | $0.010/M |
| **Reranker** | `Qwen/Qwen3-Reranker-4B` | - | 32K | $0.025/M |

### Why DeepInfra?

- ✅ Single provider for embeddings + reranking
- ✅ Complete Qwen3 family (best multilingual, 100+ languages)
- ✅ Competitive pricing ($0.01-0.025/M)
- ✅ OpenAI-compatible API
- ✅ 32K context window

---

## Environment Variables

```bash
# .env.local

# DeepInfra Configuration
VITE_DEEPINFRA_API_KEY=your-deepinfra-api-key
VITE_DEEPINFRA_BASE_URL=https://api.deepinfra.com/v1/openai

# Server-side (Supabase Edge Function secrets)
QDRANT_URL=http://78.47.165.136:6333
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_COLLECTION=saga_vectors
DEEPINFRA_API_KEY=your-deepinfra-api-key

# Optional overrides (server-side)
# DEEPINFRA_EMBED_MODEL=Qwen/Qwen3-Embedding-8B
# DEEPINFRA_EMBED_DIMENSIONS=4096 (default, native for Qwen3)
```

---

## Implementation Files

### 1. DeepInfra Provider

**File:** `packages/ai/src/providers/deepinfra.ts`

```typescript
import { createOpenAI } from "@ai-sdk/openai";

// DeepInfra uses OpenAI-compatible API
export const deepinfra = createOpenAI({
  apiKey: import.meta.env.VITE_DEEPINFRA_API_KEY,
  baseURL: "https://api.deepinfra.com/v1/openai",
});

// Model references
export const DEEPINFRA_MODELS = {
  embedding: "Qwen/Qwen3-Embedding-8B",
  reranker: "Qwen/Qwen3-Reranker-4B",
} as const;
```

### 2. Embedding Service

**File:** `packages/ai/src/services/embeddings.ts`

```typescript
import { embed, embedMany } from "ai";
import { deepinfra, DEEPINFRA_MODELS } from "../providers/deepinfra";

const EMBEDDING_DIMENSIONS = 4096; // Native dimensions for Qwen3-Embedding-8B

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.deepinfra.com/v1/openai/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_DEEPINFRA_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPINFRA_MODELS.embedding,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch("https://api.deepinfra.com/v1/openai/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_DEEPINFRA_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPINFRA_MODELS.embedding,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  
  const data = await response.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

/**
 * Format entity data for embedding
 */
export function formatEntityForEmbedding(entity: {
  name: string;
  type: string;
  aliases?: string[];
  notes?: string;
  properties?: Record<string, unknown>;
}): string {
  const parts = [
    `${entity.type}: ${entity.name}`,
    entity.aliases?.length ? `Also known as: ${entity.aliases.join(", ")}` : "",
    entity.notes || "",
    entity.properties ? JSON.stringify(entity.properties) : "",
  ];
  return parts.filter(Boolean).join("\n");
}

/**
 * Extract plain text from Tiptap JSON content
 */
export function extractTextFromTiptap(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  
  const extract = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as { type?: string; text?: string; content?: unknown[] };
    
    if (n.type === "text" && n.text) return n.text;
    if (Array.isArray(n.content)) {
      return n.content.map(extract).join(" ");
    }
    return "";
  };
  
  return extract(content).replace(/\s+/g, " ").trim();
}
```

### 3. Reranker Service

**File:** `packages/ai/src/services/reranker.ts`

```typescript
import { DEEPINFRA_MODELS } from "../providers/deepinfra";

export interface RerankResult {
  index: number;
  relevance_score: number;
}

export interface DocumentToRerank {
  id: string;
  text: string;
}

/**
 * Rerank documents based on query relevance
 * Returns documents sorted by relevance score (highest first)
 */
export async function rerankDocuments(
  query: string,
  documents: DocumentToRerank[],
  topK?: number
): Promise<Array<DocumentToRerank & { score: number }>> {
  const response = await fetch("https://api.deepinfra.com/v1/rerank", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_DEEPINFRA_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPINFRA_MODELS.reranker,
      query,
      documents: documents.map(d => d.text),
      top_n: topK || documents.length,
      return_documents: false,
    }),
  });
  
  const data = await response.json();
  const results: RerankResult[] = data.results;
  
  // Map back to original documents with scores
  return results.map(r => ({
    ...documents[r.index],
    score: r.relevance_score,
  }));
}

/**
 * Rerank search results from Qdrant
 */
export async function rerankSearchResults<T extends { id: string; text?: string; content?: string }>(
  query: string,
  results: T[],
  topK: number = 5
): Promise<Array<T & { rerank_score: number }>> {
  if (results.length === 0) return [];
  
  const documents = results.map(r => ({
    id: r.id,
    text: r.text || r.content || "",
  }));
  
  const reranked = await rerankDocuments(query, documents, topK);
  
  // Merge rerank scores back to original results
  return reranked.map(r => {
    const original = results.find(orig => orig.id === r.id)!;
    return {
      ...original,
      rerank_score: r.score,
    };
  });
}
```

### 4. Qdrant Client

**File:** `packages/db/src/clients/qdrant.ts`

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = import.meta.env.VITE_QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = import.meta.env.VITE_QDRANT_API_KEY;

let client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
  return client;
}

export const COLLECTION_NAME = import.meta.env.VITE_QDRANT_COLLECTION || "saga_vectors";
```

### 5. Vector Operations

**File:** `packages/db/src/queries/vectors.ts`

```typescript
import { getQdrantClient, COLLECTION_NAME } from "../clients/qdrant";

export type VectorType = "document" | "entity";

export interface VectorPayload {
  project_id: string;
  type: VectorType;
  document_id?: string;
  entity_id?: string;
  entity_type?: string;
  title?: string;
  content_preview?: string;
}

export interface VectorSearchResult {
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
  metadata: { title?: string; contentPreview?: string }
): Promise<void> {
  const client = getQdrantClient();
  
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{
      id: documentId,
      vector: embedding,
      payload: {
        project_id: projectId,
        type: "document" as VectorType,
        document_id: documentId,
        title: metadata.title || "",
        content_preview: metadata.contentPreview || "",
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
  metadata: { entityType: string; name?: string; notes?: string }
): Promise<void> {
  const client = getQdrantClient();
  
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{
      id: entityId,
      vector: embedding,
      payload: {
        project_id: projectId,
        type: "entity" as VectorType,
        entity_id: entityId,
        entity_type: metadata.entityType,
        title: metadata.name || "",
        content_preview: metadata.notes || "",
      },
    }],
  });
}

/**
 * Search vectors with optional filtering
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
): Promise<VectorSearchResult[]> {
  const client = getQdrantClient();
  const { type, entityType, limit = 20, scoreThreshold = 0.3 } = options || {};
  
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
 * Delete vector
 */
export async function deleteVector(id: string): Promise<void> {
  const client = getQdrantClient();
  await client.delete(COLLECTION_NAME, { wait: true, points: [id] });
}

/**
 * Delete all vectors for a project
 */
export async function deleteProjectVectors(projectId: string): Promise<void> {
  const client = getQdrantClient();
  await client.delete(COLLECTION_NAME, {
    wait: true,
    filter: { must: [{ key: "project_id", match: { value: projectId } }] },
  });
}
```

### 6. Semantic Search Hook

**File:** `apps/web/src/hooks/useSemanticSearch.ts`

```typescript
import { useState, useCallback } from "react";
import { generateEmbedding } from "@mythos/ai/services/embeddings";
import { rerankSearchResults } from "@mythos/ai/services/reranker";
import { searchVectors, VectorSearchResult } from "@mythos/db/queries/vectors";
import { useStore } from "@/stores";

export interface SearchResult {
  id: string;
  type: "document" | "entity";
  title: string;
  entityType?: string;
  preview?: string;
  vectorScore: number;
  rerankScore?: number;
}

export function useSemanticSearch() {
  const projectId = useStore((s) => s.currentProject?.id);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const search = useCallback(async (
    query: string,
    options?: {
      includeDocuments?: boolean;
      includeEntities?: boolean;
      limit?: number;
      useReranker?: boolean;
    }
  ) => {
    if (!projectId || !query.trim()) return;
    
    const {
      includeDocuments = true,
      includeEntities = true,
      limit = 10,
      useReranker = true,
    } = options || {};
    
    setIsSearching(true);
    setError(null);
    
    try {
      // 1. Generate query embedding
      const embedding = await generateEmbedding(query);
      
      // 2. Search Qdrant (get more results for reranking)
      const qdrantLimit = useReranker ? limit * 3 : limit;
      const vectorResults: VectorSearchResult[] = [];
      
      if (includeDocuments) {
        const docs = await searchVectors(projectId, embedding, {
          type: "document",
          limit: qdrantLimit,
        });
        vectorResults.push(...docs);
      }
      
      if (includeEntities) {
        const entities = await searchVectors(projectId, embedding, {
          type: "entity",
          limit: qdrantLimit,
        });
        vectorResults.push(...entities);
      }
      
      // 3. Rerank results (if enabled)
      let finalResults: SearchResult[];
      
      if (useReranker && vectorResults.length > 0) {
        const toRerank = vectorResults.map(r => ({
          id: r.id,
          text: r.payload.content_preview || r.payload.title || "",
          ...r,
        }));
        
        const reranked = await rerankSearchResults(query, toRerank, limit);
        
        finalResults = reranked.map(r => ({
          id: r.id,
          type: r.payload.type,
          title: r.payload.title || "Untitled",
          entityType: r.payload.entity_type,
          preview: r.payload.content_preview,
          vectorScore: r.score,
          rerankScore: r.rerank_score,
        }));
      } else {
        // Sort by vector score and take top K
        vectorResults.sort((a, b) => b.score - a.score);
        finalResults = vectorResults.slice(0, limit).map(r => ({
          id: r.id,
          type: r.payload.type,
          title: r.payload.title || "Untitled",
          entityType: r.payload.entity_type,
          preview: r.payload.content_preview,
          vectorScore: r.score,
        }));
      }
      
      setResults(finalResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [projectId]);
  
  return { search, results, isSearching, error, clearResults: () => setResults([]) };
}
```

### 7. Auto-Embed on Save Hook

**File:** `apps/web/src/hooks/useAutoEmbed.ts`

```typescript
import { useCallback, useRef } from "react";
import { generateEmbedding, extractTextFromTiptap } from "@mythos/ai/services/embeddings";
import { upsertDocumentVector } from "@mythos/db/queries/vectors";

const MIN_CONTENT_LENGTH = 50;

export function useAutoEmbed() {
  const pendingRef = useRef<AbortController | null>(null);
  
  const embedDocument = useCallback(async (
    documentId: string,
    projectId: string,
    content: unknown,
    title?: string
  ) => {
    // Cancel pending embedding
    if (pendingRef.current) {
      pendingRef.current.abort();
    }
    pendingRef.current = new AbortController();
    
    try {
      const plainText = extractTextFromTiptap(content);
      
      if (plainText.length < MIN_CONTENT_LENGTH) {
        return; // Skip short content
      }
      
      const embedding = await generateEmbedding(plainText);
      
      await upsertDocumentVector(documentId, projectId, embedding, {
        title,
        contentPreview: plainText.slice(0, 500),
      });
      
      console.log(`[AutoEmbed] Document ${documentId} embedded`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.warn("[AutoEmbed] Failed:", err);
      }
    }
  }, []);
  
  return { embedDocument };
}
```

---

## Search Flow with Reranking

```
┌─────────────────────────────────────────────────────────────────┐
│  User Query: "What does Kael know about the prophecy?"          │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. EMBED QUERY                                                  │
│     DeepInfra: Qwen3-Embedding-8B                               │
│     Cost: ~$0.00001 (100 tokens)                                │
│     Output: 4096-dim vector                                     │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. VECTOR SEARCH (Qdrant)                                      │
│     Collection: saga_vectors                                    │
│     Filter: project_id = "xxx"                                  │
│     Limit: 30 (3x final limit for reranking)                   │
│     Output: Rough top-30 by cosine similarity                  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. RERANK (DeepInfra)                                          │
│     Model: Qwen3-Reranker-4B                                    │
│     Input: Query + 30 document snippets                         │
│     Cost: ~$0.00005 (2000 tokens)                              │
│     Output: Precise relevance scores                            │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. RETURN TOP-K                                                 │
│     Take top 10 by rerank score                                 │
│     Include: id, title, preview, scores                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Estimation

### Per 1000 Searches

| Operation | Tokens | Price | Cost |
|-----------|--------|-------|------|
| Query embedding | 100K | $0.01/M | $0.001 |
| Reranking (30 docs × 200 tokens) | 6M | $0.025/M | $0.15 |
| **Total** | | | **$0.15** |

### Per Project (Monthly)

| Usage | Embeds | Reranks | Cost |
|-------|--------|---------|------|
| Light (100 searches) | 10K | 600K | $0.02 |
| Medium (1000 searches) | 100K | 6M | $0.16 |
| Heavy (10000 searches) | 1M | 60M | $1.51 |

### Initial Embedding (1000 docs + 500 entities)

| Item | Tokens | Cost |
|------|--------|------|
| Documents (~500 tokens avg) | 500K | $0.005 |
| Entities (~100 tokens avg) | 50K | $0.0005 |
| **Total** | 550K | **$0.006** |

---

## Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] Install dependencies: `bun add @qdrant/js-client-rest`
- [ ] Create `packages/ai/src/providers/deepinfra.ts`
- [ ] Create `packages/ai/src/services/embeddings.ts`
- [ ] Create `packages/ai/src/services/reranker.ts`
- [ ] Create `packages/db/src/clients/qdrant.ts`
- [ ] Create `packages/db/src/queries/vectors.ts`
- [ ] Add environment variables

### Phase 2: Integration Hooks

- [ ] Create `apps/web/src/hooks/useAutoEmbed.ts`
- [ ] Create `apps/web/src/hooks/useSemanticSearch.ts`
- [ ] Modify `useAutoSave.ts` to call embedDocument
- [ ] Modify `useEntityPersistence.ts` to embed entities

### Phase 3: UI Components

- [ ] Create `apps/web/src/components/search/SearchPanel.tsx`
- [ ] Add Cmd+P keyboard shortcut
- [ ] Create `apps/web/src/components/console/ChatPanel.tsx` (RAG)

### Phase 4: Backfill & Testing

- [ ] Create backfill script for existing data
- [ ] Test search quality with/without reranker
- [ ] Monitor costs via DeepInfra dashboard

---

## Hetzner Qdrant Setup

See [QDRANT_SETUP.md](./QDRANT_SETUP.md) for server configuration.

```bash
# Quick start
ssh -i ~/.ssh/hetzner_orchestrator root@78.47.165.136

# Create collection
curl -X PUT "http://localhost:6333/collections/saga_vectors" \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 4096, "distance": "Cosine"}}'
```

---

## Package Exports

### @mythos/ai

```typescript
// packages/ai/src/index.ts
export * from "./providers/deepinfra";
export * from "./services/embeddings";
export * from "./services/reranker";
```

### @mythos/db

```typescript
// packages/db/src/index.ts
export * from "./clients/qdrant";
export * from "./queries/vectors";
```

---

## References

- [DeepInfra Embeddings](https://deepinfra.com/Qwen/Qwen3-Embedding-8B)
- [DeepInfra Reranker](https://deepinfra.com/Qwen/Qwen3-Reranker-4B)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Qwen3 Embedding Paper](https://qwenlm.github.io/blog/qwen3/)
