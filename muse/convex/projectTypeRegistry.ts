import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyProjectEditor, verifyProjectOwner } from "./lib/auth";
import {
  resolveRegistry,
  validateRegistryOverride,
  type ProjectTypeRegistryOverride,
} from "./lib/typeRegistry";

const riskLevelSchema = v.union(v.literal("low"), v.literal("high"), v.literal("core"));

const entityTypeDefSchema = v.object({
  type: v.string(),
  displayName: v.string(),
  riskLevel: v.optional(riskLevelSchema),
  schema: v.optional(v.any()),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),
});

const relationshipTypeDefSchema = v.object({
  type: v.string(),
  displayName: v.string(),
  riskLevel: v.optional(riskLevelSchema),
  schema: v.optional(v.any()),
});

export const getResolvedInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const override = await ctx.db
      .query("projectTypeRegistry")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();

    return resolveRegistry(override as ProjectTypeRegistryOverride | null);
  },
});

export const getResolved = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await verifyProjectAccess(ctx, projectId);

    const override = await ctx.db
      .query("projectTypeRegistry")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();

    return resolveRegistry(override as ProjectTypeRegistryOverride | null);
  },
});

export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    entityTypes: v.array(entityTypeDefSchema),
    relationshipTypes: v.array(relationshipTypeDefSchema),
  },
  handler: async (ctx, { projectId, entityTypes, relationshipTypes }) => {
    await verifyProjectEditor(ctx, projectId);

    const existing = await ctx.db
      .query("projectTypeRegistry")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();

    if (existing?.locked === true) {
      throw new Error("REGISTRY_LOCKED");
    }

    const validation = validateRegistryOverride({ entityTypes, relationshipTypes });
    if (!validation.ok) {
      throw new Error(`INVALID_REGISTRY: ${validation.message}`);
    }

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        entityTypes,
        relationshipTypes,
        updatedAt: now,
        revision: (existing.revision ?? 0) + 1,
      });
      return existing._id;
    }

    return ctx.db.insert("projectTypeRegistry", {
      projectId,
      entityTypes,
      relationshipTypes,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    });
  },
});

export const resetToDefaults = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await verifyProjectEditor(ctx, projectId);

    const existing = await ctx.db
      .query("projectTypeRegistry")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();

    if (existing?.locked === true) {
      throw new Error("REGISTRY_LOCKED");
    }

    if (!existing) return null;

    await ctx.db.delete(existing._id as Id<"projectTypeRegistry">);
    return existing._id;
  },
});

export const lock = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await verifyProjectEditor(ctx, projectId);

    const existing = await ctx.db
      .query("projectTypeRegistry")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();

    const override = (existing ?? {
      entityTypes: [],
      relationshipTypes: [],
    }) as ProjectTypeRegistryOverride;

    const registry = resolveRegistry(override);
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const relationships = await ctx.db
      .query("relationships")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const missingEntityTypes = Array.from(
      new Set(
        entities
          .map((entity) => entity.type)
          .filter((type) => !registry.entityTypes[type])
      )
    ).sort();
    const missingRelationshipTypes = Array.from(
      new Set(
        relationships
          .map((rel) => rel.type)
          .filter((type) => !registry.relationshipTypes[type])
      )
    ).sort();

    if (missingEntityTypes.length > 0 || missingRelationshipTypes.length > 0) {
      const messageParts = [
        missingEntityTypes.length > 0
          ? `missing entity types: ${missingEntityTypes.join(", ")}`
          : null,
        missingRelationshipTypes.length > 0
          ? `missing relationship types: ${missingRelationshipTypes.join(", ")}`
          : null,
      ].filter(Boolean);
      throw new Error(`LOCK_FAILED_UNKNOWN_TYPES: ${messageParts.join("; ")}`);
    }

    if (existing?.locked === true) {
      return { locked: true, revision: existing.revision ?? 0 };
    }

    const now = Date.now();
    const revision = (existing?.revision ?? 0) + 1;

    if (existing) {
      await ctx.db.patch(existing._id, {
        locked: true,
        lockedAt: now,
        lockedByUserId: userId,
        updatedAt: now,
        revision,
      });
      return { locked: true, revision };
    }

    await ctx.db.insert("projectTypeRegistry", {
      projectId,
      entityTypes: [],
      relationshipTypes: [],
      locked: true,
      lockedAt: now,
      lockedByUserId: userId,
      createdAt: now,
      updatedAt: now,
      revision,
    });

    return { locked: true, revision };
  },
});

export const unlock = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await verifyProjectOwner(ctx, projectId);

    const existing = await ctx.db
      .query("projectTypeRegistry")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();

    const now = Date.now();
    const revision = (existing?.revision ?? 0) + 1;

    if (!existing) {
      await ctx.db.insert("projectTypeRegistry", {
        projectId,
        entityTypes: [],
        relationshipTypes: [],
        locked: false,
        createdAt: now,
        updatedAt: now,
        revision,
      });
      return { locked: false, revision };
    }

    if (existing.locked !== true) {
      return { locked: false, revision: existing.revision ?? 0 };
    }

    await ctx.db.patch(existing._id, {
      locked: false,
      updatedAt: now,
      revision,
    });

    return { locked: false, revision };
  },
});
