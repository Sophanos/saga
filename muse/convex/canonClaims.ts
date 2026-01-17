import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyProjectAccess } from "./lib/auth";

const statusSchema = v.union(v.literal("active"), v.literal("archived"));

export const list = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(statusSchema),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const baseQuery = args.status
      ? ctx.db
          .query("canonClaims")
          .withIndex("by_project_status", (q) =>
            q.eq("projectId", args.projectId).eq("status", args.status!)
          )
      : ctx.db
          .query("canonClaims")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    const claims = await baseQuery.collect();
    claims.sort((a, b) => b.createdAt - a.createdAt);
    return args.limit ? claims.slice(0, args.limit) : claims;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    text: v.string(),
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    status: v.optional(statusSchema),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();
    return await ctx.db.insert("canonClaims", {
      projectId: args.projectId,
      text: args.text.trim(),
      source: args.source,
      sourceId: args.sourceId,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const archive = mutation({
  args: {
    id: v.id("canonClaims"),
  },
  handler: async (ctx, { id }) => {
    const claim = await ctx.db.get(id);
    if (!claim) return null;

    await verifyProjectAccess(ctx, claim.projectId);

    await ctx.db.patch(id, { status: "archived", updatedAt: Date.now() });
    return id;
  },
});
