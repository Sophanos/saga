/**
 * Evidence API for image regions and links.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyProjectEditor } from "./lib/auth";

const shapeSchema = v.union(v.literal("rect"), v.literal("polygon"));
const rectSchema = v.object({ x: v.number(), y: v.number(), w: v.number(), h: v.number() });
const pointSchema = v.object({ x: v.number(), y: v.number() });
const targetTypeSchema = v.union(
  v.literal("document"),
  v.literal("entity"),
  v.literal("relationship"),
  v.literal("memory")
);

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatPercent(value: number): string {
  return (clamp01(value) * 100).toFixed(2);
}

function rectToSelector(rect: { x: number; y: number; w: number; h: number }): string {
  const x = formatPercent(rect.x);
  const y = formatPercent(rect.y);
  const w = formatPercent(rect.w);
  const h = formatPercent(rect.h);
  return `xywh=percent:${x},${y},${w},${h}`;
}

function resolveSelector(
  shape: "rect" | "polygon",
  rect: { x: number; y: number; w: number; h: number } | undefined,
  selector: string | undefined
): string {
  if (selector) return selector;
  if (shape === "rect" && rect) return rectToSelector(rect);
  return "";
}

async function requireAsset(
  ctx: { db: { get: (id: Id<"projectAssets">) => Promise<Doc<"projectAssets"> | null> } },
  projectId: Id<"projects">,
  assetId: Id<"projectAssets">
): Promise<Doc<"projectAssets">> {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.projectId !== projectId) {
    throw new Error("Asset not found");
  }
  return asset;
}

async function requireRegion(
  ctx: { db: { get: (id: Id<"assetRegions">) => Promise<Doc<"assetRegions"> | null> } },
  projectId: Id<"projects">,
  regionId: Id<"assetRegions">
): Promise<Doc<"assetRegions">> {
  const region = await ctx.db.get(regionId);
  if (!region || region.projectId !== projectId) {
    throw new Error("Region not found");
  }
  return region;
}

async function requireTarget(
  ctx: { db: { get: (id: Id<any>) => Promise<any> } },
  projectId: Id<"projects">,
  targetType: "document" | "entity" | "relationship" | "memory",
  targetId: string
): Promise<void> {
  if (targetType === "document") {
    const doc = await ctx.db.get(targetId as Id<"documents">);
    if (!doc || doc.projectId !== projectId) {
      throw new Error("Document not found");
    }
    return;
  }
  if (targetType === "entity") {
    const entity = await ctx.db.get(targetId as Id<"entities">);
    if (!entity || entity.projectId !== projectId) {
      throw new Error("Entity not found");
    }
    return;
  }
  if (targetType === "relationship") {
    const relationship = await ctx.db.get(targetId as Id<"relationships">);
    if (!relationship || relationship.projectId !== projectId) {
      throw new Error("Relationship not found");
    }
    return;
  }
  if (targetType === "memory") {
    const memory = await ctx.db.get(targetId as Id<"memories">);
    if (!memory || memory.projectId !== projectId) {
      throw new Error("Memory not found");
    }
  }
}

export const listRegionsByAsset = query({
  args: {
    projectId: v.id("projects"),
    assetId: v.id("projectAssets"),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);
    await requireAsset(ctx, args.projectId, args.assetId);

    const regions = await ctx.db
      .query("assetRegions")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .collect();

    return regions.filter((region) => !region.deletedAt);
  },
});

export const listEvidenceByTarget = query({
  args: {
    projectId: v.id("projects"),
    targetType: targetTypeSchema,
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const links = await ctx.db
      .query("evidenceLinks")
      .withIndex("by_project_target_createdAt", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId)
      )
      .order("desc")
      .collect();

    const activeLinks = links.filter((link) => !link.deletedAt);
    const results: Array<Record<string, unknown>> = [];

    for (const link of activeLinks) {
      const asset = await ctx.db.get(link.assetId);
      if (!asset || asset.projectId !== args.projectId || asset.deletedAt) continue;
      const region = link.regionId ? await ctx.db.get(link.regionId) : null;
      const imageUrl = await ctx.storage.getUrl(asset.storageId);

      results.push({
        link,
        asset,
        region: region && !region.deletedAt ? region : null,
        imageUrl: imageUrl ?? null,
      });
    }

    return results;
  },
});

export const getAssetEvidenceBundle = query({
  args: {
    projectId: v.id("projects"),
    assetId: v.id("projectAssets"),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);
    const asset = await requireAsset(ctx, args.projectId, args.assetId);

    const imageUrl = await ctx.storage.getUrl(asset.storageId);

    const regions = await ctx.db
      .query("assetRegions")
      .withIndex("by_asset_createdAt", (q) => q.eq("assetId", args.assetId))
      .order("desc")
      .collect();

    const links = await ctx.db
      .query("evidenceLinks")
      .withIndex("by_project_asset_createdAt", (q) =>
        q.eq("projectId", args.projectId).eq("assetId", args.assetId)
      )
      .order("desc")
      .collect();

    return {
      asset,
      imageUrl: imageUrl ?? null,
      regions: regions.filter((region) => !region.deletedAt),
      links: links.filter((link) => !link.deletedAt),
    };
  },
});

export const createRegion = mutation({
  args: {
    projectId: v.id("projects"),
    assetId: v.id("projectAssets"),
    shape: shapeSchema,
    rect: v.optional(rectSchema),
    polygon: v.optional(v.array(pointSchema)),
    selector: v.optional(v.string()),
    label: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorUserId = await verifyProjectEditor(ctx, args.projectId);
    await requireAsset(ctx, args.projectId, args.assetId);

    if (args.shape === "rect" && !args.rect) {
      throw new Error("Rect is required for evidence region");
    }
    if (args.shape === "polygon" && (!args.polygon || args.polygon.length < 3)) {
      throw new Error("Polygon is required for evidence region");
    }

    const selector = resolveSelector(args.shape, args.rect, args.selector);
    if (!selector) {
      throw new Error("Selector is required for evidence region");
    }

    const now = Date.now();
    const regionId = await ctx.db.insert("assetRegions", {
      projectId: args.projectId,
      assetId: args.assetId,
      shape: args.shape,
      rect: args.shape === "rect" ? args.rect : undefined,
      polygon: args.shape === "polygon" ? args.polygon : undefined,
      selector,
      label: args.label,
      note: args.note,
      actorType: "user",
      actorUserId,
      actorAgentId: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { regionId };
  },
});

export const updateRegion = mutation({
  args: {
    projectId: v.id("projects"),
    regionId: v.id("assetRegions"),
    shape: v.optional(shapeSchema),
    rect: v.optional(rectSchema),
    polygon: v.optional(v.array(pointSchema)),
    selector: v.optional(v.string()),
    label: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyProjectEditor(ctx, args.projectId);
    const region = await requireRegion(ctx, args.projectId, args.regionId);

    const nextShape = args.shape ?? region.shape;
    const nextRect = args.rect ?? region.rect;
    const nextSelector = resolveSelector(nextShape, nextRect, args.selector ?? region.selector);
    if (!nextSelector) {
      throw new Error("Selector is required for evidence region");
    }

    await ctx.db.patch(args.regionId, {
      shape: nextShape,
      rect: nextShape === "rect" ? nextRect : undefined,
      polygon: nextShape === "polygon" ? (args.polygon ?? region.polygon) : undefined,
      selector: nextSelector,
      label: args.label ?? region.label,
      note: args.note ?? region.note,
      updatedAt: Date.now(),
    });

    return { regionId: args.regionId };
  },
});

export const softDeleteRegion = mutation({
  args: {
    projectId: v.id("projects"),
    regionId: v.id("assetRegions"),
  },
  handler: async (ctx, args) => {
    await verifyProjectEditor(ctx, args.projectId);
    await requireRegion(ctx, args.projectId, args.regionId);

    await ctx.db.patch(args.regionId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { regionId: args.regionId };
  },
});

export const createEvidenceLink = mutation({
  args: {
    projectId: v.id("projects"),
    assetId: v.id("projectAssets"),
    regionId: v.optional(v.id("assetRegions")),
    targetType: targetTypeSchema,
    targetId: v.string(),
    claimPath: v.optional(v.string()),
    relation: v.optional(v.string()),
    confidence: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorUserId = await verifyProjectEditor(ctx, args.projectId);
    await requireAsset(ctx, args.projectId, args.assetId);
    if (args.regionId) {
      await requireRegion(ctx, args.projectId, args.regionId);
    }
    await requireTarget(ctx, args.projectId, args.targetType, args.targetId);

    const now = Date.now();
    const linkId = await ctx.db.insert("evidenceLinks", {
      projectId: args.projectId,
      assetId: args.assetId,
      regionId: args.regionId,
      targetType: args.targetType,
      targetId: args.targetId,
      claimPath: args.claimPath,
      relation: args.relation,
      confidence: args.confidence,
      note: args.note,
      actorType: "user",
      actorUserId,
      actorAgentId: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { linkId };
  },
});

export const softDeleteEvidenceLink = mutation({
  args: {
    projectId: v.id("projects"),
    linkId: v.id("evidenceLinks"),
  },
  handler: async (ctx, args) => {
    await verifyProjectEditor(ctx, args.projectId);
    const link = await ctx.db.get(args.linkId);
    if (!link || link.projectId !== args.projectId) {
      throw new Error("Evidence link not found");
    }

    await ctx.db.patch(args.linkId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { linkId: args.linkId };
  },
});

export const applyEvidenceMutationInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    ops: v.array(v.any()),
    actor: v.object({
      actorType: v.string(),
      actorUserId: v.optional(v.string()),
      actorAgentId: v.optional(v.string()),
      actorName: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const createdRegionIds: string[] = [];
    const createdLinkIds: string[] = [];
    const now = Date.now();

    for (const op of args.ops as Array<Record<string, unknown>>) {
      const opType = typeof op?.["type"] === "string" ? (op["type"] as string) : undefined;
      if (!opType) continue;

      if (opType === "region.create") {
        const assetId = op["assetId"] as Id<"projectAssets">;
        const shape = op["shape"] as "rect" | "polygon";
        const rect = op["rect"] as { x: number; y: number; w: number; h: number } | undefined;
        const polygon = op["polygon"] as Array<{ x: number; y: number }> | undefined;
        if (shape !== "rect" && shape !== "polygon") {
          throw new Error("Invalid evidence region shape");
        }
        if (shape === "rect" && !rect) {
          throw new Error("Rect is required for evidence region");
        }
        if (shape === "polygon" && (!polygon || polygon.length < 3)) {
          throw new Error("Polygon is required for evidence region");
        }
        await requireAsset(ctx, args.projectId, assetId);
        const selector = resolveSelector(shape, rect, op["selector"] as string | undefined);
        if (!selector) {
          throw new Error("Selector is required for evidence region");
        }
        const regionId = await ctx.db.insert("assetRegions", {
          projectId: args.projectId,
          assetId,
          shape,
          rect: shape === "rect" ? rect : undefined,
          polygon: shape === "polygon" ? polygon : undefined,
          selector,
          label: typeof op["label"] === "string" ? (op["label"] as string) : undefined,
          note: typeof op["note"] === "string" ? (op["note"] as string) : undefined,
          actorType: args.actor.actorType,
          actorUserId: args.actor.actorUserId,
          actorAgentId: args.actor.actorAgentId,
          createdAt: now,
          updatedAt: now,
        });
        createdRegionIds.push(regionId);
        continue;
      }

      if (opType === "region.delete") {
        const regionId = op["regionId"] as Id<"assetRegions">;
        await requireRegion(ctx, args.projectId, regionId);
        await ctx.db.patch(regionId, { deletedAt: now, updatedAt: now });
        continue;
      }

      if (opType === "link.create") {
        const assetId = op["assetId"] as Id<"projectAssets">;
        const regionId = op["regionId"] as Id<"assetRegions"> | undefined;
        const targetType = op["targetType"] as "document" | "entity" | "relationship" | "memory";
        const targetId = op["targetId"] as string;
        await requireAsset(ctx, args.projectId, assetId);
        if (regionId) {
          await requireRegion(ctx, args.projectId, regionId);
        }
        await requireTarget(ctx, args.projectId, targetType, targetId);
        const linkId = await ctx.db.insert("evidenceLinks", {
          projectId: args.projectId,
          assetId,
          regionId,
          targetType,
          targetId,
          claimPath: typeof op["claimPath"] === "string" ? (op["claimPath"] as string) : undefined,
          relation: typeof op["relation"] === "string" ? (op["relation"] as string) : undefined,
          confidence: typeof op["confidence"] === "number" ? (op["confidence"] as number) : undefined,
          note: typeof op["note"] === "string" ? (op["note"] as string) : undefined,
          actorType: args.actor.actorType,
          actorUserId: args.actor.actorUserId,
          actorAgentId: args.actor.actorAgentId,
          createdAt: now,
          updatedAt: now,
        });
        createdLinkIds.push(linkId);
        continue;
      }

      if (opType === "link.delete") {
        const linkId = op["linkId"] as Id<"evidenceLinks">;
        const link = await ctx.db.get(linkId);
        if (!link || link.projectId !== args.projectId) {
          throw new Error("Evidence link not found");
        }
        await ctx.db.patch(linkId, { deletedAt: now, updatedAt: now });
      }
    }

    return { createdRegionIds, createdLinkIds };
  },
});

export const softDeleteEvidenceForAssetsInternal = internalMutation({
  args: { assetIds: v.array(v.id("projectAssets")) },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const assetId of args.assetIds) {
      const asset = await ctx.db.get(assetId);
      if (!asset) continue;
      const regions = await ctx.db
        .query("assetRegions")
        .withIndex("by_asset_createdAt", (q) => q.eq("assetId", assetId))
        .collect();
      for (const region of regions) {
        await ctx.db.patch(region._id, { deletedAt: now, updatedAt: now });
      }

      const links = await ctx.db
        .query("evidenceLinks")
        .withIndex("by_project_asset_createdAt", (q) =>
          q.eq("projectId", asset.projectId).eq("assetId", assetId)
        )
        .collect();

      for (const link of links) {
        await ctx.db.patch(link._id, { deletedAt: now, updatedAt: now });
      }
    }

    return { updated: args.assetIds.length };
  },
});

export const restoreEvidenceForAssetsInternal = internalMutation({
  args: { assetIds: v.array(v.id("projectAssets")) },
  handler: async (ctx, args) => {
    for (const assetId of args.assetIds) {
      const asset = await ctx.db.get(assetId);
      if (!asset) continue;
      const regions = await ctx.db
        .query("assetRegions")
        .withIndex("by_asset_createdAt", (q) => q.eq("assetId", assetId))
        .collect();
      for (const region of regions) {
        if (region.deletedAt) {
          await ctx.db.patch(region._id, { deletedAt: undefined, updatedAt: Date.now() });
        }
      }

      const links = await ctx.db
        .query("evidenceLinks")
        .withIndex("by_project_asset_createdAt", (q) =>
          q.eq("projectId", asset.projectId).eq("assetId", assetId)
        )
        .collect();

      for (const link of links) {
        if (link.deletedAt) {
          await ctx.db.patch(link._id, { deletedAt: undefined, updatedAt: Date.now() });
        }
      }
    }

    return { restored: args.assetIds.length };
  },
});

export const deleteEvidenceForAssetsInternal = internalMutation({
  args: { assetIds: v.array(v.id("projectAssets")) },
  handler: async (ctx, args) => {
    for (const assetId of args.assetIds) {
      const asset = await ctx.db.get(assetId);
      if (!asset) continue;
      const regions = await ctx.db
        .query("assetRegions")
        .withIndex("by_asset_createdAt", (q) => q.eq("assetId", assetId))
        .collect();
      for (const region of regions) {
        await ctx.db.delete(region._id);
      }

      const links = await ctx.db
        .query("evidenceLinks")
        .withIndex("by_project_asset_createdAt", (q) =>
          q.eq("projectId", asset.projectId).eq("assetId", assetId)
        )
        .collect();
      for (const link of links) {
        await ctx.db.delete(link._id);
      }
    }

    return { deleted: args.assetIds.length };
  },
});
