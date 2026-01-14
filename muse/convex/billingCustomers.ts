/**
 * Billing customer mappings (Stripe customer IDs).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getByUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("billingCustomers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const upsertByUser = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("billingCustomers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      if (existing.stripeCustomerId !== args.stripeCustomerId) {
        await ctx.db.patch(existing._id, {
          stripeCustomerId: args.stripeCustomerId,
          updatedAt: now,
        });
      }
      return existing;
    }

    const id = await ctx.db.insert("billingCustomers", {
      userId: args.userId,
      stripeCustomerId: args.stripeCustomerId,
      createdAt: now,
      updatedAt: now,
    });

    return { _id: id, stripeCustomerId: args.stripeCustomerId };
  },
});
