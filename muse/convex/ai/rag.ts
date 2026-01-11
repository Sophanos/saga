/**
 * Saga RAG Helpers
 *
 * Retrieves project context from Qdrant and builds system prompts.
 */

import { ServerAgentEvents } from "../lib/analytics";
import { generateEmbedding, isDeepInfraConfigured } from "../lib/embeddings";
import {
  isQdrantConfigured,
  searchPoints,
  type QdrantFilter,
  type QdrantSearchResult,
} from "../lib/qdrant";
import { isRerankConfigured, rerank } from "../lib/rerank";
import type { LexicalHit } from "./lexical";
import { fetchDocumentChunkContext } from "./ragChunkContext";

const RAG_LIMIT = 10;
const CANDIDATE_LIMIT = 30;
const RRF_K = 60;
const MAX_CHUNKS_PER_DOC = 2;
const RERANK_LIMIT = 15;
const RERANK_MAX_CHARS = 1200;

export type RAGSource = "qdrant" | "lexical" | "memory" | "text";

export interface RAGContextItem {
  id: string;
  title?: string;
  name?: string;
  type: string;
  preview: string;
  chunkIndex?: number;
  category?: string;
  score?: number;
  source?: RAGSource;
}

export interface RAGContext {
  documents: RAGContextItem[];
  entities: RAGContextItem[];
  memories: RAGContextItem[];
}

interface RAGCandidate {
  key: string;
  id: string;
  kind: "document" | "entity" | "memory";
  type: string;
  title?: string;
  name?: string;
  category?: string;
  preview: string;
  rerankText?: string;
  source: RAGSource;
  pointId?: string;
  chunkIndex?: number;
  vectorScore?: number;
  lexicalScore?: number;
  rrfScore?: number;
  rerankScore?: number;
}

function getPreview(payload: Record<string, unknown>): string {
  const preview =
    (typeof payload["preview"] === "string" && payload["preview"]) ||
    (typeof payload["text"] === "string" && payload["text"]) ||
    (typeof payload["content_preview"] === "string" && payload["content_preview"]) ||
    (typeof payload["content"] === "string" && payload["content"]) ||
    "";
  return preview;
}

function getRerankText(payload: Record<string, unknown>): string {
  return (
    (typeof payload["text"] === "string" && payload["text"]) ||
    (typeof payload["content"] === "string" && payload["content"]) ||
    getPreview(payload)
  );
}

function truncateRerankText(text: string): string {
  if (text.length <= RERANK_MAX_CHARS) return text;
  return text.slice(0, RERANK_MAX_CHARS);
}

function formatChunkContextPreview(context: {
  chunkIndex: number;
  startIndex: number;
  chunks: string[];
}): string {
  const offset = context.chunkIndex - context.startIndex;
  const matchedChunk = context.chunks[offset] ?? "";
  const beforeChunks = context.chunks.slice(0, Math.max(0, offset));
  const afterChunks = context.chunks.slice(offset + 1);

  const sections: string[] = [];
  if (matchedChunk) {
    sections.push(matchedChunk);
  }
  if (beforeChunks.length > 0) {
    sections.push(`Context before:\n${beforeChunks.join("\n\n")}`);
  }
  if (afterChunks.length > 0) {
    sections.push(`Context after:\n${afterChunks.join("\n\n")}`);
  }

  return sections.join("\n\n") || context.chunks.join("\n\n");
}

function buildCandidatesFromQdrant(results: QdrantSearchResult[]): RAGCandidate[] {
  const candidates: RAGCandidate[] = [];

  for (const result of results) {
    const payload = result.payload;
    const type = payload["type"] as string;
    const preview = getPreview(payload);
    const rerankText = truncateRerankText(getRerankText(payload));

    if (type === "document") {
      const id =
        (payload["document_id"] as string | undefined) ??
        (payload["id"] as string | undefined) ??
        result.id;
      const rawChunkIndex = payload["chunk_index"];
      let parsedChunkIndex: number | undefined;
      if (typeof rawChunkIndex === "number") {
        parsedChunkIndex = rawChunkIndex;
      } else if (typeof rawChunkIndex === "string") {
        const parsed = Number(rawChunkIndex);
        if (Number.isFinite(parsed)) parsedChunkIndex = parsed;
      }
      const chunkIndex = Number.isFinite(parsedChunkIndex) ? parsedChunkIndex : undefined;
      const chunkKey = chunkIndex ?? 0;
      candidates.push({
        key: `document:${id}:${chunkKey}`,
        id,
        kind: "document",
        type: (payload["document_type"] as string | undefined) ?? "document",
        title: (payload["title"] as string | undefined) ?? undefined,
        preview,
        rerankText,
        source: "qdrant",
        pointId: result.id,
        chunkIndex,
        vectorScore: result.score,
      });
    } else if (type === "entity") {
      const id =
        (payload["entity_id"] as string | undefined) ??
        (payload["id"] as string | undefined) ??
        result.id;
      const rawChunkIndex = payload["chunk_index"];
      let parsedChunkIndex: number | undefined;
      if (typeof rawChunkIndex === "number") {
        parsedChunkIndex = rawChunkIndex;
      } else if (typeof rawChunkIndex === "string") {
        const parsed = Number(rawChunkIndex);
        if (Number.isFinite(parsed)) parsedChunkIndex = parsed;
      }
      const chunkIndex = Number.isFinite(parsedChunkIndex) ? parsedChunkIndex : undefined;
      const chunkKey = chunkIndex ?? 0;
      candidates.push({
        key: `entity:${id}:${chunkKey}`,
        id,
        kind: "entity",
        type: (payload["entity_type"] as string | undefined) ?? "entity",
        name: (payload["name"] as string | undefined) ?? (payload["title"] as string | undefined),
        preview,
        rerankText,
        source: "qdrant",
        vectorScore: result.score,
        chunkIndex,
      });
    } else if (type === "memory") {
      const id =
        (payload["memory_id"] as string | undefined) ??
        (payload["id"] as string | undefined) ??
        result.id;
      candidates.push({
        key: `memory:${id}`,
        id,
        kind: "memory",
        type: "memory",
        category: (payload["category"] as string | undefined) ?? undefined,
        preview,
        rerankText,
        source: "memory",
        vectorScore: result.score,
      });
    }
  }

  return candidates;
}

function buildCandidatesFromLexical(
  hits: LexicalHit[],
  kind: "document" | "entity"
): RAGCandidate[] {
  return hits.map((hit) => ({
    key: `${kind}:${hit.id}`,
    id: hit.id,
    kind,
    type: hit.type,
    title: hit.title,
    name: hit.name,
    preview: hit.preview,
    rerankText: truncateRerankText(hit.preview),
    source: "lexical",
    lexicalScore: hit.score,
  }));
}

function findBestCandidateKey(
  candidates: Map<string, RAGCandidate>,
  kind: "document" | "entity",
  id: string
): string | null {
  let bestKey: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [key, candidate] of candidates.entries()) {
    if (candidate.kind !== kind || candidate.id !== id) continue;
    const score = candidate.vectorScore ?? candidate.rrfScore ?? candidate.lexicalScore ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

function applyRrfScores(candidates: Map<string, RAGCandidate>, orderedKeys: string[]) {
  orderedKeys.forEach((key, index) => {
    const candidate = candidates.get(key);
    if (!candidate) return;
    const score = 1 / (RRF_K + index + 1);
    candidate.rrfScore = (candidate.rrfScore ?? 0) + score;
  });
}

function pickTopCandidates(candidates: Map<string, RAGCandidate>): RAGCandidate[] {
  return Array.from(candidates.values())
    .sort((a, b) => {
      const scoreA = a.rrfScore ?? a.vectorScore ?? a.lexicalScore ?? 0;
      const scoreB = b.rrfScore ?? b.vectorScore ?? b.lexicalScore ?? 0;
      return scoreB - scoreA;
    })
    .slice(0, CANDIDATE_LIMIT);
}

function buildContextFromCandidates(candidates: RAGCandidate[]): RAGContext {
  const context: RAGContext = { documents: [], entities: [], memories: [] };
  const docCounts = new Map<string, number>();

  for (const candidate of candidates) {
    const item: RAGContextItem = {
      id: candidate.id,
      title: candidate.title,
      name: candidate.name,
      type: candidate.type,
      preview: candidate.preview,
      chunkIndex: candidate.chunkIndex,
      category: candidate.category,
      score: candidate.rerankScore ?? candidate.rrfScore ?? candidate.vectorScore ?? candidate.lexicalScore,
      source: candidate.source,
    };

    if (candidate.kind === "document" && context.documents.length < RAG_LIMIT) {
      const count = docCounts.get(candidate.id) ?? 0;
      if (count < MAX_CHUNKS_PER_DOC) {
        context.documents.push(item);
        docCounts.set(candidate.id, count + 1);
      }
    } else if (candidate.kind === "entity" && context.entities.length < RAG_LIMIT) {
      context.entities.push(item);
    } else if (candidate.kind === "memory" && context.memories.length < RAG_LIMIT) {
      context.memories.push(item);
    }
  }

  return context;
}

export interface ChunkContextOptions {
  before?: number;
  after?: number;
}

export async function retrieveRAGContext(
  query: string,
  projectId: string,
  options?: {
    excludeMemories?: boolean;
    scope?: "all" | "documents" | "entities" | "memories";
    lexical?: { documents: LexicalHit[]; entities: LexicalHit[] };
    chunkContext?: ChunkContextOptions;
    rerank?: boolean;
    rerankTopK?: number;
    telemetry?: { distinctId: string };
  }
): Promise<RAGContext> {
  const context: RAGContext = {
    documents: [],
    entities: [],
    memories: [],
  };

  const scope = options?.scope ?? "all";
  const lexicalDocs =
    scope === "all" || scope === "documents"
      ? options?.lexical?.documents ?? []
      : [];
  const lexicalEntities =
    scope === "all" || scope === "entities"
      ? options?.lexical?.entities ?? []
      : [];

  if (!isQdrantConfigured() || !isDeepInfraConfigured()) {
    if (lexicalDocs.length === 0 && lexicalEntities.length === 0) {
      console.warn("[saga] Qdrant or DeepInfra not configured, skipping RAG");
      return context;
    }
  }

  try {
    const totalStart = Date.now();
    let embedMs = 0;
    let qdrantMs = 0;
    let rerankMs = 0;
    let chunkMs = 0;
    let denseCandidatesCount = 0;
    const lexicalCandidatesCount = lexicalDocs.length + lexicalEntities.length;
    let fusedCandidatesCount = 0;
    let rerankCandidatesCount = 0;

    const candidates = new Map<string, RAGCandidate>();
    const denseKeys: string[] = [];
    const lexicalKeys: string[] = [];

    if (isQdrantConfigured() && isDeepInfraConfigured()) {
      const embedStart = Date.now();
      const queryEmbedding = await generateEmbedding(query, { task: "embed_query" });
      embedMs = Date.now() - embedStart;

      const filter: QdrantFilter = {
        must: [{ key: "project_id", match: { value: projectId } }],
      };

      if (scope === "documents") {
        filter.must!.push({ key: "type", match: { value: "document" } });
      } else if (scope === "entities") {
        filter.must!.push({ key: "type", match: { value: "entity" } });
      } else if (scope === "memories") {
        filter.must!.push({ key: "type", match: { value: "memory" } });
      } else if (options?.excludeMemories) {
        filter.must_not = [{ key: "type", match: { value: "memory" } }];
      }

      const qdrantStart = Date.now();
      const results = await searchPoints(queryEmbedding, CANDIDATE_LIMIT, filter);
      qdrantMs = Date.now() - qdrantStart;
      const denseCandidates = buildCandidatesFromQdrant(results);
      denseCandidatesCount = denseCandidates.length;

      for (const candidate of denseCandidates) {
        if (!candidates.has(candidate.key)) {
          candidates.set(candidate.key, candidate);
        }
        denseKeys.push(candidate.key);
      }
    }

    for (const candidate of buildCandidatesFromLexical(lexicalDocs, "document")) {
      const existingKey = findBestCandidateKey(candidates, "document", candidate.id);
      const targetKey = existingKey ?? candidate.key;
      const existing = candidates.get(targetKey) ?? candidate;
      candidates.set(targetKey, {
        ...existing,
        lexicalScore: candidate.lexicalScore,
        source: existing.source ?? candidate.source,
      });
      lexicalKeys.push(targetKey);
    }

    for (const candidate of buildCandidatesFromLexical(lexicalEntities, "entity")) {
      const existingKey = findBestCandidateKey(candidates, "entity", candidate.id);
      const targetKey = existingKey ?? candidate.key;
      const existing = candidates.get(targetKey) ?? candidate;
      candidates.set(targetKey, {
        ...existing,
        lexicalScore: candidate.lexicalScore,
        source: existing.source ?? candidate.source,
      });
      lexicalKeys.push(targetKey);
    }

    if (denseKeys.length === 0 && lexicalKeys.length === 0) {
      return context;
    }

    applyRrfScores(candidates, denseKeys);
    applyRrfScores(candidates, lexicalKeys);

    let topCandidates = pickTopCandidates(candidates);
    fusedCandidatesCount = topCandidates.length;

    const rerankEnabled = options?.rerank !== false;
    const rerankLimit = Math.min(
      options?.rerankTopK ?? RERANK_LIMIT,
      topCandidates.length
    );

    if (rerankEnabled && rerankLimit > 0 && isRerankConfigured() && topCandidates.length > 0) {
      try {
        const rerankStart = Date.now();
        const rerankCandidates = topCandidates.slice(0, rerankLimit);
        rerankCandidatesCount = rerankCandidates.length;
        const texts = rerankCandidates.map(
          (candidate) => candidate.rerankText ?? candidate.preview
        );
        const scores = await rerank(query, texts);
        const reranked = rerankCandidates
          .map((candidate, index) => ({
            ...candidate,
            rerankScore: scores[index] ?? 0,
          }))
          .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
        topCandidates = [...reranked, ...topCandidates.slice(rerankCandidates.length)];
        rerankMs = Date.now() - rerankStart;
      } catch (error) {
        console.warn("[saga] Rerank failed, using fused ranking", error);
      }
    }

    if (options?.chunkContext && isQdrantConfigured()) {
      const chunkStart = Date.now();
      const docCandidates = topCandidates
        .filter((candidate) => candidate.kind === "document")
        .slice(0, RAG_LIMIT);

      await Promise.all(
        docCandidates.map(async (candidate) => {
          if (candidate.chunkIndex === undefined) return;
          try {
            const context = await fetchDocumentChunkContext(
              projectId,
              candidate.id,
              candidate.chunkIndex,
              options.chunkContext
            );
            const preview = formatChunkContextPreview(context);
            if (preview) {
              candidate.preview = preview;
            }
          } catch (error) {
            console.warn("[saga] Chunk context expansion failed", error);
          }
        })
      );
      chunkMs = Date.now() - chunkStart;
    }

    const finalContext = buildContextFromCandidates(topCandidates);
    const totalMs = Date.now() - totalStart;

    if (options?.telemetry?.distinctId) {
      try {
        await ServerAgentEvents.ragRetrievalMetrics(options.telemetry.distinctId, {
          projectId,
          scope,
          denseCandidates: denseCandidatesCount,
          lexicalCandidates: lexicalCandidatesCount,
          fusedCandidates: fusedCandidatesCount,
          rerankCandidates: rerankCandidatesCount,
          documentsReturned: finalContext.documents.length,
          entitiesReturned: finalContext.entities.length,
          memoriesReturned: finalContext.memories.length,
          embedMs,
          qdrantMs,
          rerankMs,
          chunkMs,
          totalMs,
        });
      } catch (error) {
        console.warn("[saga] RAG telemetry failed", error);
      }
    }

    console.log(
      `[saga] RAG context: ${finalContext.documents.length} docs, ` +
      `${finalContext.entities.length} entities, ${finalContext.memories.length} memories`
    );

    return finalContext;
  } catch (error) {
    console.error("[saga] RAG retrieval error:", error);
    return context;
  }
}

export function buildSystemPrompt(options: {
  mode?: string;
  ragContext: RAGContext;
  editorContext?: Record<string, unknown>;
}): string {
  const { mode = "editing", ragContext, editorContext } = options;

  let prompt = `You are Saga, an AI writing assistant for fiction authors. You help with worldbuilding, character development, plot consistency, and creative writing.\n\nCurrent mode: ${mode}\n\n## Your Capabilities\n- Detect and track story entities (characters, locations, items, factions, magic systems)\n- Check consistency across the narrative\n- Provide writing feedback and suggestions\n- Help with worldbuilding and plot development\n- Answer questions about the story world\n\n## Guidelines\n- Be concise and helpful\n- Respect the author's creative vision\n- Point out inconsistencies gently\n- Suggest rather than dictate\n- Stay in character as a supportive writing assistant\n`;

  if (ragContext.documents.length > 0) {
    prompt += `\n## Relevant Story Content\n`;
    for (const doc of ragContext.documents.slice(0, 5)) {
      prompt += `- ${doc.title || "Untitled"}: ${doc.preview.slice(0, 200)}...\n`;
    }
  }

  if (ragContext.entities.length > 0) {
    prompt += `\n## Known Entities\n`;
    for (const entity of ragContext.entities.slice(0, 10)) {
      prompt += `- ${entity.name || "Unknown"} (${entity.type}): ${entity.preview.slice(0, 100)}...\n`;
    }
  }

  if (ragContext.memories.length > 0) {
    prompt += `\n## Previous Decisions & Context\n`;
    for (const memory of ragContext.memories.slice(0, 5)) {
      prompt += `- [${memory.category || "memory"}] ${memory.preview.slice(0, 150)}...\n`;
    }
  }

  if (editorContext?.["documentTitle"]) {
    prompt += `\n## Current Document: ${editorContext["documentTitle"]}\n`;
  }

  if (editorContext?.["selectionText"]) {
    prompt += `\n## Selected Text\n\`\`\`\n${editorContext["selectionText"]}\n\`\`\`\n`;
  }

  return prompt;
}
