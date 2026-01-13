/**
 * User Queries
 *
 * User-related queries for Convex Auth.
 * Replaces betterAuth.ts user queries.
 */

import { v } from "convex/values";
import { query, internalQuery, mutation } from "./_generated/server";
import { getAuthUserId as convexGetAuthUserId } from "@convex-dev/auth/server";

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
