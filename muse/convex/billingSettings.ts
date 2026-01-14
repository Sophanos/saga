/**
 * Billing mode settings (managed vs BYOK).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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
