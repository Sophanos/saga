import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyProjectEditor } from "./lib/auth";
import {
  resolveRegistry,
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

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        entityTypes,
        relationshipTypes,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("projectTypeRegistry", {
      projectId,
      entityTypes,
      relationshipTypes,
      createdAt: now,
      updatedAt: now,
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

    if (!existing) return null;

    await ctx.db.delete(existing._id as Id<"projectTypeRegistry">);
    return existing._id;
  },
});

