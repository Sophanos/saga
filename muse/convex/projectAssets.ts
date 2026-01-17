/**
 * Project Assets Module
 *
 * File storage management for project assets (avatars, diagrams, illustrations, etc.)
 * Uses Convex file storage with soft delete support.
 */

import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const assetTypeValidator = v.union(
  v.literal("avatar"),
  v.literal("diagram"),
  v.literal("mockup"),
  v.literal("illustration"),
  v.literal("photo"),
  v.literal("map"),
  v.literal("icon"),
  v.literal("chart"),
  v.literal("reference"),
  v.literal("other")
);

function shouldEmbedAsset(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

async function scheduleImageEmbedding(
  ctx: MutationCtx,
  assetId: Id<"projectAssets">,
  projectId: Id<"projects">,
  mimeType: string
): Promise<void> {
  if (!shouldEmbedAsset(mimeType)) return;
  await ctx.scheduler.runAfter(0, internal.ai.imageEmbeddings.embedImageAsset, {
    assetId,
    projectId,
  });
}

async function scheduleImageEmbeddingDeletion(
  ctx: MutationCtx,
  assetIds: Id<"projectAssets">[]
): Promise<void> {
  if (assetIds.length === 0) return;
  await ctx.scheduler.runAfter(0, internal.ai.imageEmbeddings.deleteImageEmbeddings, {
    assetIds,
  });
}

async function scheduleProjectImageEmbeddingDeletion(
  ctx: MutationCtx,
  projectId: Id<"projects">
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.ai.imageEmbeddings.deleteImageEmbeddingsByProject, {
    projectId,
  });
}

async function scheduleEntityImageEmbeddingDeletion(
  ctx: MutationCtx,
  entityId: Id<"entities">
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.ai.imageEmbeddings.deleteImageEmbeddingsByEntity, {
    entityId,
  });
}

// ============================================================
// QUERIES
// ============================================================

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(assetTypeValidator),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, { projectId, type, includeDeleted }) => {
    let assets;

    if (type) {
      assets = await ctx.db
        .query("projectAssets")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", projectId).eq("type", type)
        )
        .collect();
    } else {
      assets = await ctx.db
        .query("projectAssets")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
    }

    if (!includeDeleted) {
      assets = assets.filter((a) => !a.deletedAt);
    }

    return assets;
  },
});

export const listByEntity = query({
  args: { entityId: v.id("entities") },
  handler: async (ctx, { entityId }) => {
    const assets = await ctx.db
      .query("projectAssets")
      .withIndex("by_entity", (q) => q.eq("entityId", entityId))
      .collect();

    return assets.filter((a) => !a.deletedAt);
  },
});

export const get = query({
  args: { id: v.id("projectAssets") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("projectAssets") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return ctx.storage.getUrl(storageId);
  },
});

// ============================================================
// UPLOAD FLOW
// ============================================================

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAsset = mutation({
  args: {
    projectId: v.id("projects"),
    entityId: v.optional(v.id("entities")),
    type: assetTypeValidator,
    filename: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sizeBytes: v.number(),
    altText: v.optional(v.string()),
    generationPrompt: v.optional(v.string()),
    generationModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const assetId = await ctx.db.insert("projectAssets", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    await scheduleImageEmbedding(ctx, assetId, args.projectId, args.mimeType);

    return assetId;
  },
});

// Internal version for actions
export const saveAssetInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    entityId: v.optional(v.id("entities")),
    type: assetTypeValidator,
    filename: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sizeBytes: v.number(),
    altText: v.optional(v.string()),
    generationPrompt: v.optional(v.string()),
    generationModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const assetId = await ctx.db.insert("projectAssets", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });

    await scheduleImageEmbedding(ctx, assetId, args.projectId, args.mimeType);

    return assetId;
  },
});

// ============================================================
// MUTATIONS
// ============================================================

export const update = mutation({
  args: {
    id: v.id("projectAssets"),
    entityId: v.optional(v.id("entities")),
    type: v.optional(assetTypeValidator),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const asset = await ctx.db.get(id);
    if (!asset) {
      throw new Error("Asset not found");
    }

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const softDelete = mutation({
  args: { id: v.id("projectAssets") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const restore = mutation({
  args: { id: v.id("projectAssets") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const hardDelete = mutation({
  args: { id: v.id("projectAssets") },
  handler: async (ctx, { id }) => {
    const asset = await ctx.db.get(id);
    if (!asset) return;

    // Delete storage files
    await ctx.storage.delete(asset.storageId);
    if (asset.thumbnailStorageId) {
      await ctx.storage.delete(asset.thumbnailStorageId);
    }

    await ctx.db.delete(id);

    if (shouldEmbedAsset(asset.mimeType)) {
      await scheduleImageEmbeddingDeletion(ctx, [asset._id]);
    }
  },
});

// ============================================================
// INTERNAL HELPERS
// ============================================================

export const deleteByProject = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const assets = await ctx.db
      .query("projectAssets")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const asset of assets) {
      await ctx.storage.delete(asset.storageId);
      if (asset.thumbnailStorageId) {
        await ctx.storage.delete(asset.thumbnailStorageId);
      }
      await ctx.db.delete(asset._id);
    }

    if (assets.length > 0) {
      await scheduleProjectImageEmbeddingDeletion(ctx, projectId);
    }

    return { deleted: assets.length };
  },
});

export const deleteByEntity = internalMutation({
  args: { entityId: v.id("entities") },
  handler: async (ctx, { entityId }) => {
    const assets = await ctx.db
      .query("projectAssets")
      .withIndex("by_entity", (q) => q.eq("entityId", entityId))
      .collect();

    for (const asset of assets) {
      await ctx.storage.delete(asset.storageId);
      if (asset.thumbnailStorageId) {
        await ctx.storage.delete(asset.thumbnailStorageId);
      }
      await ctx.db.delete(asset._id);
    }

    if (assets.length > 0) {
      await scheduleEntityImageEmbeddingDeletion(ctx, entityId);
    }

    return { deleted: assets.length };
  },
});

export const cleanupSoftDeleted = internalMutation({
  args: { olderThanDays: v.optional(v.number()) },
  handler: async (ctx, { olderThanDays = 30 }) => {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const deleted = await ctx.db
      .query("projectAssets")
      .withIndex("by_deleted")
      .collect();

    const toDelete = deleted.filter(
      (a) => a.deletedAt && a.deletedAt < cutoff
    );

    const assetsToDelete = toDelete.slice(0, 100);
    const embeddableIds = assetsToDelete
      .filter((asset) => shouldEmbedAsset(asset.mimeType))
      .map((asset) => asset._id);

    for (const asset of assetsToDelete) {
      await ctx.storage.delete(asset.storageId);
      if (asset.thumbnailStorageId) {
        await ctx.storage.delete(asset.thumbnailStorageId);
      }
      await ctx.db.delete(asset._id);
    }

    await scheduleImageEmbeddingDeletion(ctx, embeddableIds);

    return { deleted: Math.min(toDelete.length, 100) };
  },
});

// ============================================================
// ACTIONS (for external operations)
// ============================================================

export const storeFromUrlInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    entityId: v.optional(v.id("entities")),
    type: assetTypeValidator,
    filename: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    sizeBytes: v.number(),
    altText: v.optional(v.string()),
    generationPrompt: v.optional(v.string()),
    generationModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const assetId = await ctx.db.insert("projectAssets", {
      projectId: args.projectId,
      entityId: args.entityId,
      type: args.type,
      filename: args.filename,
      mimeType: args.mimeType,
      storageId: args.storageId,
      sizeBytes: args.sizeBytes,
      altText: args.altText,
      generationPrompt: args.generationPrompt,
      generationModel: args.generationModel,
      createdAt: now,
      updatedAt: now,
    });

    await scheduleImageEmbedding(ctx, assetId, args.projectId, args.mimeType);

    return assetId;
  },
});

export const storeFromUrl = action({
  args: {
    projectId: v.id("projects"),
    entityId: v.optional(v.id("entities")),
    type: assetTypeValidator,
    url: v.string(),
    filename: v.string(),
    altText: v.optional(v.string()),
    generationPrompt: v.optional(v.string()),
    generationModel: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ assetId: string; storageId: string }> => {
    const response = await fetch(args.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    const storageId = await ctx.storage.store(blob);

    const assetId = await ctx.runMutation(
      internal.projectAssets.storeFromUrlInternal,
      {
        projectId: args.projectId,
        entityId: args.entityId,
        type: args.type,
        filename: args.filename,
        mimeType: blob.type || "application/octet-stream",
        storageId,
        sizeBytes: blob.size,
        altText: args.altText,
        generationPrompt: args.generationPrompt,
        generationModel: args.generationModel,
      }
    );

    return { assetId: assetId as string, storageId: storageId as string };
  },
});
