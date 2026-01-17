/**
 * Task-driven model routing resolver.
 *
 * Resolves the effective task config + model chain, with BYOK overrides
 * where applicable. This runs as an internal query so actions can reuse it.
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { AITaskSlug, LlmTaskConfig, TierId } from "../lib/providers/types";
import { getTaskConfig, normalizeTaskSlug, checkTaskAccessForConfig } from "../lib/providers/taskConfig";
import { getModalityForTask, isValidTask } from "../lib/providers/types";

export type TaskRoutingModel = {
  provider: string;
  model: string;
};

export type TaskRouting = {
  normalizedTaskSlug: AITaskSlug;
  config: LlmTaskConfig;
  modelChain: {
    direct: TaskRoutingModel;
    fallback1?: TaskRoutingModel;
    fallback2?: TaskRoutingModel;
  };
  byok: {
    enabled: boolean;
    preferredModel?: string;
    keyRequired: boolean;
  };
};

function resolveTierId(raw: unknown): TierId | null {
  if (raw === "free" || raw === "pro" || raw === "team" || raw === "enterprise") {
    return raw;
  }
  return null;
}

export const resolveTaskRouting = internalQuery({
  args: {
    userId: v.string(),
    taskSlug: v.string(),
    tierId: v.optional(v.string()),
    hasByokKey: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<TaskRouting> => {
    if (!isValidTask(args.taskSlug)) {
      throw new Error(`Unknown task slug: ${args.taskSlug}`);
    }

    const normalized = normalizeTaskSlug(args.taskSlug) as AITaskSlug;
    const config = await getTaskConfig(ctx, normalized);
    const tierId = resolveTierId(args.tierId) ?? config.minTier;

    const access = checkTaskAccessForConfig(config, tierId);
    if (!access.allowed) {
      throw new Error(access.reason ?? "Task is not accessible");
    }

    const billingRecord = await ctx.db
      .query("userBillingSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const byokEnabled = billingRecord?.billingMode === "byok";
    const hasByokKey = args.hasByokKey === true;
    const preferredModel = byokEnabled ? billingRecord?.preferredModel : undefined;
    const modality = config.modality ?? getModalityForTask(normalized);

    const applyByokOverride =
      byokEnabled &&
      hasByokKey &&
      config.directProvider === "openrouter" &&
      (modality === "text" || modality === "world") &&
      typeof preferredModel === "string" &&
      preferredModel.trim().length > 0;

    const directModel = applyByokOverride ? preferredModel!.trim() : config.directModel;

    return {
      normalizedTaskSlug: normalized,
      config: {
        ...config,
        directModel,
        modality,
      },
      modelChain: {
        direct: { provider: config.directProvider, model: directModel },
        ...(config.fallback1Provider && config.fallback1Model
          ? { fallback1: { provider: config.fallback1Provider, model: config.fallback1Model } }
          : {}),
        ...(config.fallback2Provider && config.fallback2Model
          ? { fallback2: { provider: config.fallback2Provider, model: config.fallback2Model } }
          : {}),
      },
      byok: {
        enabled: byokEnabled,
        preferredModel: preferredModel ?? undefined,
        keyRequired: byokEnabled && config.directProvider === "openrouter",
      },
    };
  },
});
