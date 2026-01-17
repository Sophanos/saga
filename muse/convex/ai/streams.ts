/**
 * AI Generation Streams
 *
 * Manages streaming state and delta persistence for AI responses.
 * Allows clients to:
 * - Resume streams after disconnect
 * - Subscribe to real-time updates
 * - Replay missed chunks
 */

import { v } from "convex/values";
import {
  query,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// ============================================================
// Chunk Types
// ============================================================

export const chunkSchema = v.object({
  index: v.number(),
  type: v.string(), // "delta" | "tool" | "tool-approval-request" | "context" | "error"
  content: v.string(),
  // Tool-specific fields
  toolCallId: v.optional(v.string()),
  toolName: v.optional(v.string()),
  approvalId: v.optional(v.string()),
  suggestionId: v.optional(v.string()),
  approvalType: v.optional(v.string()),
  danger: v.optional(v.string()),
  args: v.optional(v.any()),
  data: v.optional(v.any()),
  promptMessageId: v.optional(v.string()),
});

export type StreamChunk = {
  index: number;
  type: string;
  content: string;
  toolCallId?: string;
  toolName?: string;
  approvalId?: string;
  suggestionId?: string;
  approvalType?: string;
  danger?: string;
  args?: unknown;
  data?: unknown;
  promptMessageId?: string;
};

// ============================================================
// Internal Mutations (called from HTTP actions)
// ============================================================

/**
 * Create a new generation stream
 */
export const create = internalMutation({
  args: {
    projectId: v.string(),
    userId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, { projectId, userId, type }) => {
    const id = await ctx.db.insert("generationStreams", {
      projectId: projectId as Id<"projects">,
      userId,
      type,
      status: "streaming",
      chunkCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Append a chunk to a stream
 */
export const appendChunk = internalMutation({
  args: {
    streamId: v.string(),
    chunk: v.object({
      type: v.string(),
      content: v.string(),
      toolCallId: v.optional(v.string()),
      toolName: v.optional(v.string()),
      approvalId: v.optional(v.string()),
      suggestionId: v.optional(v.string()),
      approvalType: v.optional(v.string()),
      danger: v.optional(v.string()),
      args: v.optional(v.any()),
      data: v.optional(v.any()),
      promptMessageId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { streamId, chunk }) => {
    const stream = await ctx.db.get(streamId as Id<"generationStreams">);
    if (!stream) {
      throw new Error("Stream not found");
    }

    const legacyChunks = (stream as { chunks?: StreamChunk[] }).chunks;
    const nextIndex = stream.chunkCount ?? legacyChunks?.length ?? 0;
    const newChunk = { ...chunk, index: nextIndex };

    await ctx.db.insert("generationStreamChunks", {
      streamId: streamId as Id<"generationStreams">,
      index: nextIndex,
      type: newChunk.type,
      content: newChunk.content,
      toolCallId: newChunk.toolCallId,
      toolName: newChunk.toolName,
      approvalId: newChunk.approvalId,
      suggestionId: newChunk.suggestionId,
      approvalType: newChunk.approvalType,
      danger: newChunk.danger,
      args: newChunk.args,
      data: newChunk.data,
      promptMessageId: newChunk.promptMessageId,
      createdAt: Date.now(),
    });

    await ctx.db.patch(streamId as Id<"generationStreams">, {
      chunkCount: nextIndex + 1,
      updatedAt: Date.now(),
    });

    return nextIndex;
  },
});

/**
 * Mark stream as complete
 */
export const complete = internalMutation({
  args: {
    streamId: v.string(),
    result: v.optional(v.any()),
  },
  handler: async (ctx, { streamId, result }) => {
    await ctx.db.patch(streamId as Id<"generationStreams">, {
      status: "done",
      result,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark stream as failed
 */
export const fail = internalMutation({
  args: {
    streamId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, { streamId, error }) => {
    await ctx.db.patch(streamId as Id<"generationStreams">, {
      status: "error",
      error,
      updatedAt: Date.now(),
    });
  },
});

// ============================================================
// Internal Queries (called from HTTP actions)
// ============================================================

/**
 * Get stream chunks after a specific index (for polling)
 */
export const getChunks = internalQuery({
  args: {
    streamId: v.string(),
    afterIndex: v.optional(v.number()),
  },
  handler: async (ctx, { streamId, afterIndex }) => {
    const stream = await ctx.db.get(streamId as Id<"generationStreams">);
    if (!stream) {
      return null;
    }

    const startIndex = afterIndex ?? 0;
    const chunks = await ctx.db
      .query("generationStreamChunks")
      .withIndex("by_stream_index", (q) =>
        q.eq("streamId", streamId as Id<"generationStreams">).gte("index", startIndex)
      )
      .order("asc")
      .collect();

    const legacyChunks = (stream as { chunks?: StreamChunk[] }).chunks;
    const legacySlice = legacyChunks
      ? legacyChunks.filter((c: StreamChunk) => c.index >= startIndex)
      : [];

    return {
      status: stream.status,
      chunks: chunks.length > 0 ? chunks : legacySlice,
      result: stream.result,
      error: stream.error,
    };
  },
});

/**
 * Get full stream state
 */
export const get = internalQuery({
  args: {
    streamId: v.string(),
  },
  handler: async (ctx, { streamId }) => {
    return ctx.db.get(streamId as Id<"generationStreams">);
  },
});

export const getToolCallArgs = internalQuery({
  args: {
    streamId: v.string(),
    toolCallId: v.string(),
    toolName: v.optional(v.string()),
  },
  handler: async (ctx, { streamId, toolCallId, toolName }) => {
    const chunks = await ctx.db
      .query("generationStreamChunks")
      .withIndex("by_stream", (q) => q.eq("streamId", streamId as Id<"generationStreams">))
      .filter((q) => q.eq(q.field("toolCallId"), toolCallId))
      .collect();

    const match = chunks.find((chunk) => {
      if (toolName && chunk.toolName !== toolName) return false;
      return chunk.args !== undefined;
    });

    if (match?.args) {
      return { args: match.args, toolName: match.toolName };
    }

    const stream = await ctx.db.get(streamId as Id<"generationStreams">);
    if (!stream) return null;
    const legacyChunks = (stream as { chunks?: StreamChunk[] }).chunks ?? [];
    const legacyMatch = legacyChunks.find((chunk) => {
      if (chunk.toolCallId !== toolCallId) return false;
      if (toolName && chunk.toolName !== toolName) return false;
      return chunk.args !== undefined;
    });

    if (!legacyMatch?.args) return null;

    return { args: legacyMatch.args, toolName: legacyMatch.toolName };
  },
});

// ============================================================
// Public Queries (for client subscriptions)
// ============================================================

/**
 * Watch a stream for real-time updates
 * Client can subscribe to this for live streaming
 */
export const watch = query({
  args: {
    streamId: v.id("generationStreams"),
  },
  handler: async (ctx, { streamId }) => {
    const stream = await ctx.db.get(streamId);
    if (!stream) {
      return null;
    }

    const legacyChunks = (stream as { chunks?: StreamChunk[] }).chunks;
    const chunkCount = stream.chunkCount ?? legacyChunks?.length ?? 0;

    const lastStoredChunk = await ctx.db
      .query("generationStreamChunks")
      .withIndex("by_stream_index", (q) => q.eq("streamId", streamId))
      .order("desc")
      .first();

    const lastChunk =
      lastStoredChunk ?? (legacyChunks ? legacyChunks[legacyChunks.length - 1] ?? null : null);

    // Return essential state for UI
    return {
      status: stream.status,
      chunkCount,
      lastChunk,
      result: stream.result,
      error: stream.error,
      updatedAt: stream.updatedAt,
    };
  },
});

/**
 * Get stream chunks for replay (after reconnect)
 */
export const replay = query({
  args: {
    streamId: v.id("generationStreams"),
    afterIndex: v.optional(v.number()),
  },
  handler: async (ctx, { streamId, afterIndex }) => {
    const stream = await ctx.db.get(streamId);
    if (!stream) {
      return null;
    }

    const startIndex = afterIndex ?? 0;
    const chunks = await ctx.db
      .query("generationStreamChunks")
      .withIndex("by_stream_index", (q) =>
        q.eq("streamId", streamId).gte("index", startIndex)
      )
      .order("asc")
      .collect();

    const legacyChunks = (stream as { chunks?: StreamChunk[] }).chunks;
    const legacySlice = legacyChunks
      ? legacyChunks.filter((c: StreamChunk) => c.index >= startIndex)
      : [];

    return {
      status: stream.status,
      chunks: chunks.length > 0 ? chunks : legacySlice,
      result: stream.result,
      error: stream.error,
    };
  },
});

/**
 * List recent streams for a user (for debugging/history)
 */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    return ctx.db
      .query("generationStreams")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});
