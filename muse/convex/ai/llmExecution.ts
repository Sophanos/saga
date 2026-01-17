/**
 * Shared LLM execution resolver.
 *
 * Centralizes task routing, BYOK selection, and quota enforcement.
 */

import type { ActionCtx } from "../_generated/server";
import type { AITaskSlug, LlmTaskConfig, ReasoningEffort, ResponseFormat, TierId } from "../lib/providers/types";
import { assertAiAllowed, type AiEndpoint } from "../lib/quotaEnforcement";
import { resolveOpenRouterKey, isByokRequest } from "../lib/openRouterKey";
import type { TaskRouting } from "./modelRouting";

const internal = require("../_generated/api").internal as any;

export type ExecutionContext = {
  taskSlug: AITaskSlug;
  config: LlmTaskConfig;
  resolved: { provider: string; model: string };
  apiKey?: string;
  billingModeUsed: "byok" | "managed" | "anonymous";
  maxOutputTokens: number;
  responseFormat: ResponseFormat;
  temperature?: number;
  topP?: number;
  reasoningEffort?: ReasoningEffort;
};

export type ResolveExecutionArgs = {
  userId: string;
  taskSlug: AITaskSlug;
  tierId: TierId;
  byokKey?: string;
  requestedMaxOutputTokens?: number;
  promptText: string;
  contextTokens?: number;
  endpoint: AiEndpoint;
  skipQuota?: boolean;
};

function resolveMaxTokens(
  requestedMaxOutputTokens: number | undefined,
  config: LlmTaskConfig,
  quotaMaxOutputTokens?: number
): number {
  const fallback = config.maxTokensOut ?? 4096;
  const requested = requestedMaxOutputTokens ?? fallback;
  const configCap = config.maxTokensOut ?? requested;
  const base = Math.min(requested, configCap);
  if (typeof quotaMaxOutputTokens === "number") {
    return Math.max(1, Math.min(base, quotaMaxOutputTokens));
  }
  return Math.max(1, base);
}

export async function resolveExecutionContext(
  ctx: ActionCtx,
  args: ResolveExecutionArgs
): Promise<ExecutionContext> {
  const routing = (await ctx.runQuery((internal as any)["ai/modelRouting"].resolveTaskRouting, {
    userId: args.userId,
    taskSlug: args.taskSlug,
    tierId: args.tierId,
    hasByokKey: isByokRequest(args.byokKey),
  })) as TaskRouting;

  const isByokEnabled = routing.byok.enabled;
  const isByok = isByokEnabled && isByokRequest(args.byokKey);
  const resolved = routing.modelChain.direct;

  let quotaMaxOutputTokens: number | undefined;
  if (!isByok && !args.skipQuota) {
    const quota = await assertAiAllowed(ctx, {
      userId: args.userId,
      endpoint: args.endpoint,
      promptText: args.promptText,
      contextTokens: args.contextTokens,
      requestedMaxOutputTokens: args.requestedMaxOutputTokens,
      billingModeUsed: "managed",
    });
    quotaMaxOutputTokens = quota.maxOutputTokens;
  }

  const apiKey =
    resolved.provider === "openrouter" && isByok
      ? resolveOpenRouterKey(args.byokKey).apiKey
      : undefined;

  const maxOutputTokens = resolveMaxTokens(
    args.requestedMaxOutputTokens,
    routing.config,
    quotaMaxOutputTokens
  );

  return {
    taskSlug: routing.normalizedTaskSlug,
    config: routing.config,
    resolved,
    apiKey,
    billingModeUsed: isByok ? "byok" : "managed",
    maxOutputTokens,
    responseFormat: routing.config.responseFormat,
    temperature: routing.config.temperature,
    topP: routing.config.topP,
    reasoningEffort: routing.config.reasoningEffort,
  };
}
