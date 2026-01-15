/**
 * User Queries
 *
 * User-related queries for Convex Auth.
 * Replaces betterAuth.ts user queries.
 */

import { v } from "convex/values";
import { query, internalQuery, mutation } from "./_generated/server";
import { getAuthUserId as convexGetAuthUserId } from "@convex-dev/auth/server";
import { verifyProjectAccess } from "./lib/auth";
import type { SearchUsersResult } from "../packages/agent-protocol/src/tools";

type UserDoc = { _id: string; name?: string; email?: string };

/**
 * Get the current authenticated user
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await convexGetAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    return ctx.db.get(userId);
  },
});

/**
 * Internal query to get user by ID
 */
export const getUserById = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      return await ctx.db.get(args.userId as any);
    } catch {
      return null;
    }
  },
});

/**
 * Get user's subscription status
 */
export const getUserSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await convexGetAuthUserId(ctx);
    if (!userId) return null;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId as string).eq("status", "active")
      )
      .first();

    return subscription;
  },
});

/**
 * Check if user has a specific entitlement
 */
export const hasEntitlement = query({
  args: {
    entitlement: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await convexGetAuthUserId(ctx);
    if (!userId) return false;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId as string).eq("status", "active")
      )
      .first();

    if (!subscription) return false;

    return subscription.entitlements.includes(args.entitlement);
  },
});

/**
 * Update the current user's profile
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await convexGetAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const updates: Record<string, string> = {};
    if (args.name !== undefined) updates["name"] = args.name;
    if (args.image !== undefined) updates["image"] = args.image;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates);
    }

    return ctx.db.get(userId);
  },
});

export const searchProjectUsers = query({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SearchUsersResult> => {
    await verifyProjectAccess(ctx, args.projectId);

    const needle = args.query.trim().toLowerCase();
    if (!needle) return { users: [] };

    const limit = args.limit ?? 10;
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const users = await Promise.all(
      members.slice(0, 250).map(async (member) => {
        try {
          return (await ctx.db.get(member.userId as any)) as UserDoc | null;
        } catch {
          return null;
        }
      })
    );

    const hits = users
      .filter((user): user is UserDoc => user != null)
      .map((user) => {
        const name = (user.name ?? "").trim();
        const email = (user.email ?? "").trim();
        return { id: user._id, name: name || email || user._id, email: email || undefined };
      })
      .filter((user) => {
        const nameMatch = user.name.toLowerCase().includes(needle);
        const emailMatch = (user.email ?? "").toLowerCase().includes(needle);
        return nameMatch || emailMatch;
      })
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(needle) || (a.email ?? "").toLowerCase().startsWith(needle);
        const bStarts = b.name.toLowerCase().startsWith(needle) || (b.email ?? "").toLowerCase().startsWith(needle);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);

    return { users: hits };
  },
});
