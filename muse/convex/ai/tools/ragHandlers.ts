/**
 * RAG Tool Handlers - Server-side execution for agent tools
 */

import { v } from "convex/values";
import { internalAction, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { retrieveRAGContext } from "../rag";
import { fetchDocumentChunkContext } from "../ragChunkContext";
import { searchPoints, type QdrantFilter } from "../../lib/qdrant";
import { generateEmbedding, isDeepInfraConfigured } from "../../lib/embeddings";

const DEFAULT_LIMIT = 5;
const CHUNK_CONTEXT_BEFORE = 2;
const CHUNK_CONTEXT_AFTER = 1;

type Scope = "all" | "documents" | "entities" | "memories";

interface SearchResult {
  id: string;
  type: string;
  title?: string;
  name?: string;
  preview: string;
  score: number;
  source: string;
}

export const executeSearchContext = internalAction({
  args: {
    projectId: v.string(),
    query: v.string(),
    scope: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<SearchResult[]> => {
    const { projectId, query, limit = DEFAULT_LIMIT } = args;
    const scope = (args.scope ?? "all") as Scope;

    const ragContext = await retrieveRAGContext(query, projectId, {
      excludeMemories: scope === "documents" || scope === "entities",
      chunkContext: { before: CHUNK_CONTEXT_BEFORE, after: CHUNK_CONTEXT_AFTER },
    });

    const results: SearchResult[] = [];

    if (scope === "all" || scope === "documents") {
      for (const doc of ragContext.documents.slice(0, limit)) {
        results.push({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          preview: doc.preview,
          score: doc.score ?? 0,
          source: doc.source ?? "qdrant",
        });
      }
    }

    if (scope === "all" || scope === "entities") {
      for (const entity of ragContext.entities.slice(0, limit)) {
        results.push({
          id: entity.id,
          type: entity.type,
          name: entity.name,
          preview: entity.preview,
          score: entity.score ?? 0,
          source: entity.source ?? "qdrant",
        });
      }
    }

    if (scope === "all" || scope === "memories") {
      for (const memory of ragContext.memories.slice(0, limit)) {
        results.push({
          id: memory.id,
          type: "memory",
          title: memory.category,
          preview: memory.preview,
          score: memory.score ?? 0,
          source: "memory",
        });
      }
    }

    return results.slice(0, limit);
  },
});

export const getDocumentById = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    return await ctx.db.get(documentId);
  },
});

export const executeReadDocument = internalAction({
  args: {
    projectId: v.string(),
    documentId: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const doc: Awaited<ReturnType<typeof ctx.runQuery>> = await ctx.runQuery((internal as any)["ai/tools/ragHandlers"].getDocumentById, {
      documentId: args.documentId as Id<"documents">,
    });

    if (!doc) {
      return { error: "Document not found" };
    }

    if (doc.projectId !== args.projectId) {
      return { error: "Access denied" };
    }

    return {
      id: doc._id,
      title: doc.title ?? "Untitled",
      type: doc.type,
      content: doc.contentText ?? "",
      wordCount: doc.wordCount,
    };
  },
});

export const executeSearchChapters = internalAction({
  args: {
    projectId: v.string(),
    query: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { projectId, query, type } = args;

    if (!isDeepInfraConfigured()) {
      return { error: "Embeddings not configured" };
    }

    const embedding = await generateEmbedding(query);

    const filter: QdrantFilter = {
      must: [
        { key: "project_id", match: { value: projectId } },
        { key: "type", match: { value: "document" } },
      ],
    };

    if (type && type !== "all") {
      filter.must!.push({ key: "document_type", match: { value: type } });
    }

    const results = await searchPoints(embedding, 10, filter);

    return results.map((r) => ({
      id: r.payload["document_id"] as string,
      type: r.payload["document_type"] as string,
      title: r.payload["title"] as string,
      preview: (r.payload["preview"] as string) ?? (r.payload["text"] as string)?.slice(0, 200),
      score: r.score,
    }));
  },
});

export const executeSearchWorld = internalAction({
  args: {
    projectId: v.string(),
    query: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { projectId, query, category } = args;

    if (!isDeepInfraConfigured()) {
      return { error: "Embeddings not configured" };
    }

    const embedding = await generateEmbedding(query);

    const worldTypes = ["location", "faction", "magic_system", "concept"];
    const filter: QdrantFilter = {
      must: [
        { key: "project_id", match: { value: projectId } },
        { key: "type", match: { value: "entity" } },
      ],
    };

    if (category && category !== "all") {
      filter.must!.push({ key: "entity_type", match: { value: category } });
    } else {
      filter.must!.push({ key: "entity_type", match: { any: worldTypes } });
    }

    const results = await searchPoints(embedding, 10, filter);

    return results.map((r) => ({
      id: r.payload["entity_id"] as string,
      type: r.payload["entity_type"] as string,
      name: r.payload["title"] as string,
      preview: (r.payload["preview"] as string) ?? (r.payload["text"] as string)?.slice(0, 200),
      score: r.score,
    }));
  },
});

export const getEntityById = internalQuery({
  args: { entityId: v.id("entities") },
  handler: async (ctx, { entityId }) => {
    return await ctx.db.get(entityId);
  },
});

export const getEntityRelationships = internalQuery({
  args: { entityId: v.id("entities") },
  handler: async (ctx, { entityId }) => {
    const asSource = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", entityId))
      .collect();

    const asTarget = await ctx.db
      .query("relationships")
      .withIndex("by_target", (q) => q.eq("targetId", entityId))
      .collect();

    return [...asSource, ...asTarget].map((r) => ({
      id: r._id,
      type: r.type,
      sourceId: r.sourceId,
      targetId: r.targetId,
      bidirectional: r.bidirectional,
      notes: r.notes,
    }));
  },
});

export const executeGetEntity = internalAction({
  args: {
    projectId: v.string(),
    entityId: v.string(),
    includeRelationships: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const entity = await ctx.runQuery((internal as any)["ai/tools/ragHandlers"].getEntityById, {
      entityId: args.entityId as Id<"entities">,
    });

    if (!entity) {
      return { error: "Entity not found" };
    }

    if (entity.projectId !== args.projectId) {
      return { error: "Access denied" };
    }

    const result: Record<string, unknown> = {
      id: entity._id,
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases,
      properties: entity.properties,
      notes: entity.notes,
    };

    if (args.includeRelationships) {
      const relationships = await ctx.runQuery(
        (internal as any)["ai/tools/ragHandlers"].getEntityRelationships,
        { entityId: entity._id }
      );
      result["relationships"] = relationships;
    }

    return result;
  },
});

export async function expandChunkContext(
  results: Array<{ id: string; payload: Record<string, unknown>; score: number }>,
  options: { before?: number; after?: number; projectId?: string } = {}
): Promise<Array<{ id: string; chunks: string[]; score: number }>> {
  const before = options.before ?? CHUNK_CONTEXT_BEFORE;
  const after = options.after ?? CHUNK_CONTEXT_AFTER;

  const expanded = await Promise.all(
    results.map(async (result) => {
      const docId = result.payload["document_id"] as string | undefined;
      const chunkIndex = result.payload["chunk_index"] as number | undefined;
      const projectId = options.projectId ?? (result.payload["project_id"] as string | undefined);

      if (!docId || chunkIndex === undefined || !projectId) {
        return {
          id: result.id,
          chunks: [result.payload["text"] as string],
          score: result.score,
        };
      }

      const context = await fetchDocumentChunkContext(projectId, docId, chunkIndex, {
        before,
        after,
      });

      return {
        id: result.id,
        chunks: context.chunks,
        score: result.score,
      };
    })
  );

  return expanded;
}
