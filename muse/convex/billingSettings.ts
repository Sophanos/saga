/**
 * Billing mode settings (managed vs BYOK).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getBillingMode = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return record?.billingMode === "byok" ? "byok" : "managed";
  },
});

export const setBillingMode = internalMutation({
  args: {
    userId: v.string(),
    mode: v.union(v.literal("managed"), v.literal("byok")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        billingMode: args.mode,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userBillingSettings", {
        userId: args.userId,
        billingMode: args.mode,
        updatedAt: now,
      });
    }

    return { success: true, billingMode: args.mode };
  },
});

/**
 * Default model for managed users.
 */
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

/**
 * Get user's preferred model (for BYOK users).
 * Falls back to platform default if not set.
 */
export const getPreferredModel = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Only return custom model for BYOK users who have set one
    if (record?.billingMode === "byok" && record.preferredModel) {
      return record.preferredModel;
    }

    return DEFAULT_MODEL;
  },
});

/**
 * Set user's preferred model (for BYOK users).
 */
export const setPreferredModel = internalMutation({
  args: {
    userId: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        preferredModel: args.model,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userBillingSettings", {
        userId: args.userId,
        billingMode: "byok", // Setting model implies BYOK
        preferredModel: args.model,
        updatedAt: now,
      });
    }

    return { success: true, preferredModel: args.model };
  },
});

/**
 * Get full billing settings for a user.
 */
export const getBillingSettings = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return {
      billingMode: record?.billingMode === "byok" ? "byok" : "managed",
      preferredModel: record?.preferredModel ?? DEFAULT_MODEL,
    };
  },
});

// ============================================================
// Public API (for Expo/React Native clients)
// ============================================================

/**
 * Get current user's billing settings.
 */
export const getMyBillingSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const record = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      billingMode: (record?.billingMode === "byok" ? "byok" : "managed") as "managed" | "byok",
      preferredModel: record?.preferredModel ?? DEFAULT_MODEL,
    };
  },
});

/**
 * Set current user's billing mode.
 */
export const setMyBillingMode = mutation({
  args: { mode: v.union(v.literal("managed"), v.literal("byok")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        billingMode: args.mode,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userBillingSettings", {
        userId,
        billingMode: args.mode,
        updatedAt: now,
      });
    }

    return { success: true, billingMode: args.mode };
  },
});

/**
 * Set current user's preferred model.
 */
export const setMyPreferredModel = mutation({
  args: { model: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        preferredModel: args.model,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userBillingSettings", {
        userId,
        billingMode: "byok",
        preferredModel: args.model,
        updatedAt: now,
      });
    }

    return { success: true, preferredModel: args.model };
  },
});
