/**
 * Convex Memories Functions
 *
 * CRUD operations for AI memories with Qdrant vector sync.
 * Memories are project-scoped and can expire based on tier.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess } from "./lib/auth";

// Memory categories
export const MEMORY_CATEGORIES = [
  "decision",
  "fact",
  "preference",
  "style",
  "session",
  "context",
] as const;

export type MemoryCategory = typeof MEMORY_CATEGORIES[number];

// Memory sources
export const MEMORY_SOURCES = ["user", "agent", "inferred"] as const;
export type MemorySource = typeof MEMORY_SOURCES[number];

// ============================================================
// QUERIES
// ============================================================

/**
 * List memories for a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
    pinnedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();
    let query;

    if (args.pinnedOnly) {
      query = ctx.db
        .query("memories")
        .withIndex("by_pinned", (q) =>
          q.eq("projectId", args.projectId).eq("pinned", true)
        );
    } else if (args.type) {
      query = ctx.db
        .query("memories")
        .withIndex("by_type", (q) =>
          q.eq("projectId", args.projectId).eq("type", args.type!)
        );
    } else {
      query = ctx.db
        .query("memories")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId));
    }

    const memories = await query.collect();

    // Filter out expired memories
    const validMemories = memories.filter(
      (m) => !m.expiresAt || m.expiresAt > now
    );

    // Sort by createdAt desc and limit
    const sorted = validMemories.sort((a, b) => b.createdAt - a.createdAt);
    return args.limit ? sorted.slice(0, args.limit) : sorted;
  },
});

/**
 * Get a single memory by ID
 */
export const get = query({
  args: {
    id: v.id("memories"),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.id);
    if (!memory) return null;

    await verifyProjectAccess(ctx, memory.projectId);

    // Check if expired
    if (memory.expiresAt && memory.expiresAt <= Date.now()) {
      return null;
    }

    return memory;
  },
});

/**
 * Search memories by text
 */
export const search = query({
  args: {
    projectId: v.id("projects"),
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const results = await ctx.db
      .query("memories")
      .withSearchIndex("search_memories", (q) =>
        q.search("text", args.searchQuery).eq("projectId", args.projectId)
      )
      .take(args.limit ?? 10);

    const now = Date.now();
    return results.filter((m) => !m.expiresAt || m.expiresAt > now);
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new memory
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    text: v.string(),
    type: v.string(),
    confidence: v.optional(v.number()),
    source: v.optional(v.string()),
    entityIds: v.optional(v.array(v.string())),
    documentId: v.optional(v.id("documents")),
    pinned: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await verifyProjectAccess(ctx, args.projectId);
    const now = Date.now();

    const id = await ctx.db.insert("memories", {
      projectId: args.projectId,
      userId,
      text: args.text,
      type: args.type,
      confidence: args.confidence ?? 1.0,
      source: args.source ?? "user",
      entityIds: args.entityIds,
      documentId: args.documentId,
      pinned: args.pinned ?? false,
      expiresAt: args.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    // Enqueue embedding job for vector sync
    await ctx.runMutation(internal.memories.enqueueVectorSync, {
      memoryId: id,
      projectId: args.projectId,
    });

    return id;
  },
});

/**
 * Update a memory
 */
export const update = mutation({
  args: {
    id: v.id("memories"),
    text: v.optional(v.string()),
    type: v.optional(v.string()),
    confidence: v.optional(v.number()),
    pinned: v.optional(v.boolean()),
    entityIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.id);
    if (!memory) {
      throw new Error("Memory not found");
    }

    await verifyProjectAccess(ctx, memory.projectId);

    const { id, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    // Re-sync vector if text changed
    if (args.text) {
      await ctx.runMutation(internal.memories.enqueueVectorSync, {
        memoryId: id,
        projectId: memory.projectId,
      });
    }

    return id;
  },
});

/**
 * Delete a memory (soft delete - marks for Qdrant cleanup)
 */
export const remove = mutation({
  args: {
    id: v.id("memories"),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.id);
    if (!memory) {
      throw new Error("Memory not found");
    }

    await verifyProjectAccess(ctx, memory.projectId);

    // Enqueue vector deletion before deleting record
    if (memory.vectorId) {
      await ctx.runMutation(internal.memories.enqueueVectorDelete, {
        vectorIds: [memory.vectorId],
        projectId: memory.projectId,
      });
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Bulk delete memories by project (for project deletion cascade)
 */
export const removeByProject = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Collect vector IDs for deletion
    const vectorIds = memories
      .filter((m) => m.vectorId)
      .map((m) => m.vectorId!);

    // Enqueue vector deletion
    if (vectorIds.length > 0) {
      await ctx.runMutation(internal.memories.enqueueVectorDelete, {
        vectorIds,
        projectId: args.projectId,
      });
    }

    // Delete all memory records
    for (const memory of memories) {
      await ctx.db.delete(memory._id);
    }

    return memories.length;
  },
});

// ============================================================
// INTERNAL MUTATIONS (for vector sync)
// ============================================================

/**
 * Enqueue vector sync job
 */
export const enqueueVectorSync = internalMutation({
  args: {
    memoryId: v.id("memories"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // This will be processed by the embedding jobs processor
    await ctx.db.insert("embeddingJobs", {
      projectId: args.projectId,
      targetType: "memory",
      targetId: args.memoryId,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Enqueue vector deletion job
 */
export const enqueueVectorDelete = internalMutation({
  args: {
    vectorIds: v.array(v.string()),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // This will be processed by a vector deletion job processor
    // For now, we store the intent - actual Qdrant deletion happens in an action
    for (const vectorId of args.vectorIds) {
      await ctx.db.insert("embeddingJobs", {
        projectId: args.projectId,
        targetType: "memory_delete",
        targetId: vectorId,
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Update memory vector sync status
 */
export const updateVectorStatus = internalMutation({
  args: {
    memoryId: v.id("memories"),
    vectorId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoryId, {
      vectorId: args.vectorId,
      vectorSyncedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Purge expired memories (called by cron)
 */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("memories")
      .withIndex("by_expiry")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Group by project for batch deletion
    const byProject = new Map<Id<"projects">, string[]>();
    for (const memory of expired) {
      if (memory.vectorId) {
        const existing = byProject.get(memory.projectId) ?? [];
        existing.push(memory.vectorId);
        byProject.set(memory.projectId, existing);
      }
    }

    // Enqueue vector deletions per project
    for (const [projectId, ids] of byProject) {
      await ctx.runMutation(internal.memories.enqueueVectorDelete, {
        vectorIds: ids,
        projectId,
      });
    }

    // Delete expired records
    for (const memory of expired) {
      await ctx.db.delete(memory._id);
    }

    return expired.length;
  },
});
