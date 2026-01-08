/**
 * Lexical search helpers for hybrid retrieval.
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export interface LexicalHit {
  id: string;
  title?: string;
  name?: string;
  type: string;
  preview: string;
  score?: number;
  source: "lexical";
}

export const searchDocuments = internalQuery({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, query, limit }) => {
    const docs = await ctx.db
      .query("documents")
      .withSearchIndex("search_documents", (q) =>
        q.search("contentText", query).eq("projectId", projectId)
      )
      .take(Math.min(limit ?? 10, 50));

    return docs.map((doc) => {
      const score = (doc as { _score?: number })._score;
      const preview = doc.contentText ? doc.contentText.slice(0, 200) : "";
      return {
        id: doc._id,
        title: doc.title ?? "Untitled",
        type: doc.type ?? "document",
        preview,
        score,
        source: "lexical" as const,
      } satisfies LexicalHit;
    });
  },
});

export const searchEntities = internalQuery({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, query, limit }) => {
    const entities = await ctx.db
      .query("entities")
      .withSearchIndex("search_entities", (q) =>
        q.search("name", query).eq("projectId", projectId)
      )
      .take(Math.min(limit ?? 10, 50));

    return entities.map((entity) => {
      const score = (entity as { _score?: number })._score;
      const preview = entity.notes ? entity.notes.slice(0, 200) : "";
      return {
        id: entity._id,
        name: entity.name,
        type: entity.type,
        preview,
        score,
        source: "lexical" as const,
      } satisfies LexicalHit;
    });
  },
});
