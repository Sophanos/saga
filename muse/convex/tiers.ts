/**
 * Tier Configuration Management
 *
 * CRUD operations for subscription tiers.
 * Includes seed function for initial data.
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { TIER_DEFAULTS, type TierId } from "./lib/tierConfig";

// ============================================================
// Validators
// ============================================================

const tierConfigValidator = {
  tier: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  priceMonthlyCents: v.number(),
  priceYearlyCents: v.number(),
  ai: v.object({
    tokensPerMonth: v.optional(v.number()),
    callsPerDay: v.number(),
    concurrentRequests: v.number(),
    models: v.array(v.string()),
  }),
  aiFeatures: v.object({
    chat: v.boolean(),
    lint: v.boolean(),
    coach: v.boolean(),
    detect: v.boolean(),
    search: v.boolean(),
    webSearch: v.boolean(),
    imageGeneration: v.boolean(),
    styleAdaptation: v.boolean(),
  }),
  memory: v.object({
    retentionDays: v.optional(v.number()),
    maxPerProject: v.number(),
    maxPinned: v.number(),
  }),
  embeddings: v.object({
    operationsPerDay: v.number(),
    maxVectorsPerProject: v.number(),
    queuePriority: v.number(),
  }),
  projects: v.object({
    maxProjects: v.number(),
    maxDocumentsPerProject: v.number(),
    maxEntitiesPerProject: v.number(),
    maxWordsPerMonth: v.optional(v.number()),
    storageMB: v.number(),
  }),
  collaboration: v.object({
    enabled: v.boolean(),
    maxCollaboratorsPerProject: v.optional(v.number()),
  }),
  features: v.object({
    prioritySupport: v.boolean(),
    customModels: v.boolean(),
    apiAccess: v.boolean(),
    exportEnabled: v.boolean(),
  }),
  metadata: v.optional(v.any()),
};

// ============================================================
// Queries
// ============================================================

/**
 * Get all active tier configurations
 */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("tierConfigs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Get a specific tier by ID
 */
export const getByTier = query({
  args: { tier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .first();
  },
});

/**
 * Internal query for use in other Convex functions
 */
export const getByTierInternal = internalQuery({
  args: { tier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .first();
  },
});

/**
 * Get all tiers (including inactive) - admin only
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tierConfigs").collect();
  },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new tier configuration
 */
export const create = mutation({
  args: tierConfigValidator,
  handler: async (ctx, args) => {
    // Check for duplicate tier
    const existing = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .first();

    if (existing) {
      throw new Error(`Tier "${args.tier}" already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("tierConfigs", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing tier configuration
 */
export const update = mutation({
  args: {
    tier: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      priceMonthlyCents: v.optional(v.number()),
      priceYearlyCents: v.optional(v.number()),
      ai: v.optional(
        v.object({
          tokensPerMonth: v.optional(v.number()),
          callsPerDay: v.number(),
          concurrentRequests: v.number(),
          models: v.array(v.string()),
        })
      ),
      aiFeatures: v.optional(
        v.object({
          chat: v.boolean(),
          lint: v.boolean(),
          coach: v.boolean(),
          detect: v.boolean(),
          search: v.boolean(),
          webSearch: v.boolean(),
          imageGeneration: v.boolean(),
          styleAdaptation: v.boolean(),
        })
      ),
      memory: v.optional(
        v.object({
          retentionDays: v.optional(v.number()),
          maxPerProject: v.number(),
          maxPinned: v.number(),
        })
      ),
      embeddings: v.optional(
        v.object({
          operationsPerDay: v.number(),
          maxVectorsPerProject: v.number(),
          queuePriority: v.number(),
        })
      ),
      projects: v.optional(
        v.object({
          maxProjects: v.number(),
          maxDocumentsPerProject: v.number(),
          maxEntitiesPerProject: v.number(),
          maxWordsPerMonth: v.optional(v.number()),
          storageMB: v.number(),
        })
      ),
      collaboration: v.optional(
        v.object({
          enabled: v.boolean(),
          maxCollaboratorsPerProject: v.optional(v.number()),
        })
      ),
      features: v.optional(
        v.object({
          prioritySupport: v.boolean(),
          customModels: v.boolean(),
          apiAccess: v.boolean(),
          exportEnabled: v.boolean(),
        })
      ),
      metadata: v.optional(v.any()),
      isActive: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .first();

    if (!existing) {
      throw new Error(`Tier "${args.tier}" not found`);
    }

    await ctx.db.patch(existing._id, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

/**
 * Deactivate a tier (soft delete)
 */
export const deactivate = mutation({
  args: { tier: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .first();

    if (!existing) {
      throw new Error(`Tier "${args.tier}" not found`);
    }

    await ctx.db.patch(existing._id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

// ============================================================
// Seed Functions
// ============================================================

/**
 * Seed default tier configurations
 * Run this once to populate initial data
 */
export const seedDefaults = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tiers: TierId[] = ["free", "pro", "team"];
    const now = Date.now();

    for (const tierId of tiers) {
      // Check if already exists
      const existing = await ctx.db
        .query("tierConfigs")
        .withIndex("by_tier", (q) => q.eq("tier", tierId))
        .first();

      if (existing) {
        console.log(`Tier "${tierId}" already exists, skipping`);
        continue;
      }

      const defaults = TIER_DEFAULTS[tierId];
      await ctx.db.insert("tierConfigs", {
        tier: tierId,
        name: defaults.name,
        description: defaults.description,
        priceMonthlyCents: defaults.price.monthly * 100,
        priceYearlyCents: defaults.price.yearly * 100,
        ai: {
          tokensPerMonth: defaults.ai.tokensPerMonth ?? undefined,
          callsPerDay: defaults.ai.callsPerDay,
          concurrentRequests: defaults.ai.concurrentRequests,
          models: defaults.ai.models,
        },
        aiFeatures: defaults.aiFeatures,
        memory: {
          retentionDays: defaults.memory.retentionDays ?? undefined,
          maxPerProject: defaults.memory.maxPerProject,
          maxPinned: defaults.memory.maxPinned,
        },
        embeddings: defaults.embeddings,
        projects: {
          ...defaults.projects,
          maxWordsPerMonth: defaults.projects.maxWordsPerMonth ?? undefined,
        },
        collaboration: {
          ...defaults.collaboration,
          maxCollaboratorsPerProject: defaults.collaboration.maxCollaboratorsPerProject ?? undefined,
        },
        features: defaults.features,
        metadata: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`Seeded tier "${tierId}"`);
    }
  },
});

/**
 * Reset all tiers to defaults (dangerous!)
 */
export const resetToDefaults = internalMutation({
  args: { confirm: v.literal("I understand this will delete all tier configs") },
  handler: async (ctx) => {
    // Delete all existing
    const existing = await ctx.db.query("tierConfigs").collect();
    for (const tier of existing) {
      await ctx.db.delete(tier._id);
    }

    // Re-seed
    const tiers: TierId[] = ["free", "pro", "team"];
    const now = Date.now();

    for (const tierId of tiers) {
      const defaults = TIER_DEFAULTS[tierId];
      await ctx.db.insert("tierConfigs", {
        tier: tierId,
        name: defaults.name,
        description: defaults.description,
        priceMonthlyCents: defaults.price.monthly * 100,
        priceYearlyCents: defaults.price.yearly * 100,
        ai: {
          tokensPerMonth: defaults.ai.tokensPerMonth ?? undefined,
          callsPerDay: defaults.ai.callsPerDay,
          concurrentRequests: defaults.ai.concurrentRequests,
          models: defaults.ai.models,
        },
        aiFeatures: defaults.aiFeatures,
        memory: {
          retentionDays: defaults.memory.retentionDays ?? undefined,
          maxPerProject: defaults.memory.maxPerProject,
          maxPinned: defaults.memory.maxPinned,
        },
        embeddings: defaults.embeddings,
        projects: {
          ...defaults.projects,
          maxWordsPerMonth: defaults.projects.maxWordsPerMonth ?? undefined,
        },
        collaboration: {
          ...defaults.collaboration,
          maxCollaboratorsPerProject: defaults.collaboration.maxCollaboratorsPerProject ?? undefined,
        },
        features: defaults.features,
        metadata: {},
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { reset: true, count: tiers.length };
  },
});
