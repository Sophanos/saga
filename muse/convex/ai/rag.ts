/**
 * Saga RAG Helpers
 *
 * Retrieves project context from Qdrant and builds system prompts.
 */

import {
  searchPoints,
  isQdrantConfigured,
  type QdrantFilter,
  type QdrantSearchResult,
} from "../lib/qdrant";
import { generateEmbedding, isDeepInfraConfigured } from "../lib/embeddings";
import { rerank, isRerankConfigured } from "../lib/rerank";
import type { LexicalHit } from "./lexical";
import { fetchDocumentChunkContext } from "./ragChunkContext";

const RAG_LIMIT = 10;
const CANDIDATE_LIMIT = 30;
const RRF_K = 60;

export type RAGSource = "qdrant" | "lexical" | "memory" | "text";

export interface RAGContextItem {
  id: string;
  title?: string;
  name?: string;
  type: string;
  preview: string;
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

    if (type === "document") {
      const id =
        (payload["document_id"] as string | undefined) ??
        (payload["id"] as string | undefined) ??
        result.id;
      const rawChunkIndex = payload["chunk_index"];
      const parsedChunkIndex =
        typeof rawChunkIndex === "number"
          ? rawChunkIndex
          : typeof rawChunkIndex === "string"
            ? Number(rawChunkIndex)
            : undefined;
      const chunkIndex = Number.isFinite(parsedChunkIndex) ? parsedChunkIndex : undefined;
      candidates.push({
        key: `document:${id}`,
        id,
        kind: "document",
        type: (payload["document_type"] as string | undefined) ?? "document",
        title: (payload["title"] as string | undefined) ?? undefined,
        preview,
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
      candidates.push({
        key: `entity:${id}`,
        id,
        kind: "entity",
        type: (payload["entity_type"] as string | undefined) ?? "entity",
        name: (payload["name"] as string | undefined) ?? (payload["title"] as string | undefined),
        preview,
        source: "qdrant",
        vectorScore: result.score,
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
    source: "lexical",
    lexicalScore: hit.score,
  }));
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

  for (const candidate of candidates) {
    const item: RAGContextItem = {
      id: candidate.id,
      title: candidate.title,
      name: candidate.name,
      type: candidate.type,
      preview: candidate.preview,
      category: candidate.category,
      score: candidate.rerankScore ?? candidate.rrfScore ?? candidate.vectorScore ?? candidate.lexicalScore,
      source: candidate.source,
    };

    if (candidate.kind === "document" && context.documents.length < RAG_LIMIT) {
      context.documents.push(item);
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
    lexical?: { documents: LexicalHit[]; entities: LexicalHit[] };
    chunkContext?: ChunkContextOptions;
  }
): Promise<RAGContext> {
  const context: RAGContext = {
    documents: [],
    entities: [],
    memories: [],
  };

  const lexicalDocs = options?.lexical?.documents ?? [];
  const lexicalEntities = options?.lexical?.entities ?? [];

  if (!isQdrantConfigured() || !isDeepInfraConfigured()) {
    if (lexicalDocs.length === 0 && lexicalEntities.length === 0) {
      console.warn("[saga] Qdrant or DeepInfra not configured, skipping RAG");
      return context;
    }
  }

  try {
    const candidates = new Map<string, RAGCandidate>();
    const denseKeys: string[] = [];
    const lexicalKeys: string[] = [];

    if (isQdrantConfigured() && isDeepInfraConfigured()) {
      const queryEmbedding = await generateEmbedding(query);

      const filter: QdrantFilter = {
        must: [{ key: "project_id", match: { value: projectId } }],
      };

      if (options?.excludeMemories) {
        filter.must_not = [{ key: "type", match: { value: "memory" } }];
      }

      const results = await searchPoints(queryEmbedding, RAG_LIMIT * 3, filter);
      const denseCandidates = buildCandidatesFromQdrant(results);

      for (const candidate of denseCandidates) {
        if (!candidates.has(candidate.key)) {
          candidates.set(candidate.key, candidate);
        }
        denseKeys.push(candidate.key);
      }
    }

    for (const candidate of buildCandidatesFromLexical(lexicalDocs, "document")) {
      candidates.set(candidate.key, {
        ...(candidates.get(candidate.key) ?? candidate),
        lexicalScore: candidate.lexicalScore,
        source: candidates.get(candidate.key)?.source ?? candidate.source,
      });
      lexicalKeys.push(candidate.key);
    }

    for (const candidate of buildCandidatesFromLexical(lexicalEntities, "entity")) {
      candidates.set(candidate.key, {
        ...(candidates.get(candidate.key) ?? candidate),
        lexicalScore: candidate.lexicalScore,
        source: candidates.get(candidate.key)?.source ?? candidate.source,
      });
      lexicalKeys.push(candidate.key);
    }

    if (denseKeys.length === 0 && lexicalKeys.length === 0) {
      return context;
    }

    applyRrfScores(candidates, denseKeys);
    applyRrfScores(candidates, lexicalKeys);

    let topCandidates = pickTopCandidates(candidates);

    if (isRerankConfigured() && topCandidates.length > 0) {
      try {
        const texts = topCandidates.map((candidate) => candidate.preview);
        const scores = await rerank(query, texts);
        topCandidates = topCandidates
          .map((candidate, index) => ({
            ...candidate,
            rerankScore: scores[index] ?? 0,
          }))
          .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
      } catch (error) {
        console.warn("[saga] Rerank failed, using fused ranking", error);
      }
    }

    if (options?.chunkContext && isQdrantConfigured()) {
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
    }

    const finalContext = buildContextFromCandidates(topCandidates);

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
