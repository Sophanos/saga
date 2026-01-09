/**
 * Seed Data for Providers and Task Configs
 *
 * Run via Convex mutation to populate database with defaults.
 */

import { mutation } from "../../_generated/server";
import { DEFAULT_PROVIDERS } from "./registry";
import { DEFAULT_TASK_CONFIGS } from "./taskConfig";

/**
 * Seed default LLM providers to database
 */
export const seedProviders = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let created = 0;
    let skipped = 0;

    for (const [slug, config] of Object.entries(DEFAULT_PROVIDERS)) {
      // Check if already exists
      const existing = await ctx.db
        .query("llmProviders")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("llmProviders", {
        slug: config.slug,
        displayName: config.displayName,
        baseUrl: config.baseUrl,
        apiKeyEnv: config.apiKeyEnv,
        adapterType: config.adapterType,
        supportsStreaming: config.supportsStreaming,
        priority: config.priority,
        enabled: true,
        markupPercent: config.markupPercent,
        updatedAt: now,
      });
      created++;
    }

    return { created, skipped, total: Object.keys(DEFAULT_PROVIDERS).length };
  },
});

/**
 * Seed default task configs to database
 */
export const seedTaskConfigs = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let created = 0;
    let skipped = 0;

    for (const [taskSlug, config] of Object.entries(DEFAULT_TASK_CONFIGS)) {
      // Check if already exists
      const existing = await ctx.db
        .query("llmTaskConfigs")
        .withIndex("by_task", (q) => q.eq("taskSlug", taskSlug))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("llmTaskConfigs", {
        taskSlug: config.taskSlug,
        modality: config.modality,
        description: config.description,
        directModel: config.directModel,
        directProvider: config.directProvider,
        fallback1Model: config.fallback1Model,
        fallback1Provider: config.fallback1Provider,
        fallback2Model: config.fallback2Model,
        fallback2Provider: config.fallback2Provider,
        maxTokensIn: config.maxTokensIn,
        maxTokensOut: config.maxTokensOut,
        maxTokensOutBrief: config.maxTokensOutBrief,
        maxTokensOutStandard: config.maxTokensOutStandard,
        maxTokensOutDeep: config.maxTokensOutDeep,
        maxCostUsd: config.maxCostUsd,
        temperature: config.temperature,
        topP: config.topP,
        reasoningEffort: config.reasoningEffort,
        responseFormat: config.responseFormat,
        priceInPerM: config.priceInPerM,
        priceOutPerM: config.priceOutPerM,
        fallback1PriceInPerM: config.fallback1PriceInPerM,
        fallback1PriceOutPerM: config.fallback1PriceOutPerM,
        fallback2PriceInPerM: config.fallback2PriceInPerM,
        fallback2PriceOutPerM: config.fallback2PriceOutPerM,
        minTier: config.minTier,
        enabled: config.enabled,
        updatedAt: now,
      });
      created++;
    }

    return { created, skipped, total: Object.keys(DEFAULT_TASK_CONFIGS).length };
  },
});

/**
 * Seed all defaults (providers + task configs)
 */
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Seed providers
    let providersCreated = 0;
    for (const [slug, config] of Object.entries(DEFAULT_PROVIDERS)) {
      const existing = await ctx.db
        .query("llmProviders")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existing) {
        await ctx.db.insert("llmProviders", {
          slug: config.slug,
          displayName: config.displayName,
          baseUrl: config.baseUrl,
          apiKeyEnv: config.apiKeyEnv,
          adapterType: config.adapterType,
          supportsStreaming: config.supportsStreaming,
          priority: config.priority,
          enabled: true,
          markupPercent: config.markupPercent,
          updatedAt: now,
        });
        providersCreated++;
      }
    }

    // Seed task configs
    let tasksCreated = 0;
    for (const [taskSlug, config] of Object.entries(DEFAULT_TASK_CONFIGS)) {
      const existing = await ctx.db
        .query("llmTaskConfigs")
        .withIndex("by_task", (q) => q.eq("taskSlug", taskSlug))
        .first();

      if (!existing) {
        await ctx.db.insert("llmTaskConfigs", {
          taskSlug: config.taskSlug,
          modality: config.modality,
          description: config.description,
          directModel: config.directModel,
          directProvider: config.directProvider,
          fallback1Model: config.fallback1Model,
          fallback1Provider: config.fallback1Provider,
          fallback2Model: config.fallback2Model,
          fallback2Provider: config.fallback2Provider,
          maxTokensIn: config.maxTokensIn,
          maxTokensOut: config.maxTokensOut,
          maxTokensOutBrief: config.maxTokensOutBrief,
          maxTokensOutStandard: config.maxTokensOutStandard,
          maxTokensOutDeep: config.maxTokensOutDeep,
          maxCostUsd: config.maxCostUsd,
          temperature: config.temperature,
          topP: config.topP,
          reasoningEffort: config.reasoningEffort,
          responseFormat: config.responseFormat,
          priceInPerM: config.priceInPerM,
          priceOutPerM: config.priceOutPerM,
          fallback1PriceInPerM: config.fallback1PriceInPerM,
          fallback1PriceOutPerM: config.fallback1PriceOutPerM,
          fallback2PriceInPerM: config.fallback2PriceInPerM,
          fallback2PriceOutPerM: config.fallback2PriceOutPerM,
          minTier: config.minTier,
          enabled: config.enabled,
          updatedAt: now,
        });
        tasksCreated++;
      }
    }

    return {
      providers: { created: providersCreated, total: Object.keys(DEFAULT_PROVIDERS).length },
      tasks: { created: tasksCreated, total: Object.keys(DEFAULT_TASK_CONFIGS).length },
    };
  },
});

/**
 * Reset all configs to defaults (destructive!)
 */
export const resetToDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Delete all existing providers
    const existingProviders = await ctx.db.query("llmProviders").collect();
    for (const provider of existingProviders) {
      await ctx.db.delete(provider._id);
    }

    // Delete all existing task configs
    const existingTasks = await ctx.db.query("llmTaskConfigs").collect();
    for (const task of existingTasks) {
      await ctx.db.delete(task._id);
    }

    // Re-seed providers
    for (const config of Object.values(DEFAULT_PROVIDERS)) {
      await ctx.db.insert("llmProviders", {
        slug: config.slug,
        displayName: config.displayName,
        baseUrl: config.baseUrl,
        apiKeyEnv: config.apiKeyEnv,
        adapterType: config.adapterType,
        supportsStreaming: config.supportsStreaming,
        priority: config.priority,
        enabled: true,
        markupPercent: config.markupPercent,
        updatedAt: now,
      });
    }

    // Re-seed task configs
    for (const config of Object.values(DEFAULT_TASK_CONFIGS)) {
      await ctx.db.insert("llmTaskConfigs", {
        taskSlug: config.taskSlug,
        modality: config.modality,
        description: config.description,
        directModel: config.directModel,
        directProvider: config.directProvider,
        fallback1Model: config.fallback1Model,
        fallback1Provider: config.fallback1Provider,
        fallback2Model: config.fallback2Model,
        fallback2Provider: config.fallback2Provider,
        maxTokensIn: config.maxTokensIn,
        maxTokensOut: config.maxTokensOut,
        maxTokensOutBrief: config.maxTokensOutBrief,
        maxTokensOutStandard: config.maxTokensOutStandard,
        maxTokensOutDeep: config.maxTokensOutDeep,
        maxCostUsd: config.maxCostUsd,
        temperature: config.temperature,
        topP: config.topP,
        reasoningEffort: config.reasoningEffort,
        responseFormat: config.responseFormat,
        priceInPerM: config.priceInPerM,
        priceOutPerM: config.priceOutPerM,
        fallback1PriceInPerM: config.fallback1PriceInPerM,
        fallback1PriceOutPerM: config.fallback1PriceOutPerM,
        fallback2PriceInPerM: config.fallback2PriceInPerM,
        fallback2PriceOutPerM: config.fallback2PriceOutPerM,
        minTier: config.minTier,
        enabled: config.enabled,
        updatedAt: now,
      });
    }

    return {
      deleted: { providers: existingProviders.length, tasks: existingTasks.length },
      created: {
        providers: Object.keys(DEFAULT_PROVIDERS).length,
        tasks: Object.keys(DEFAULT_TASK_CONFIGS).length,
      },
    };
  },
});
