/**
 * Rate Limiting for Convex Functions
 *
 * Uses @convex-dev/rate-limiter for persistent, distributed rate limiting.
 * Supports both fixed window and token bucket algorithms.
 *
 * Best Practices (from Convex docs):
 * - Token bucket: smooth traffic, allows bursts up to capacity
 * - Fixed window: hard limits that reset at period end
 * - Sharding: for high throughput (shards ≈ max_QPS / 2)
 * - Dual limits: per-user AND global for AI/token usage
 * - Reserve pattern: check() before with estimate, limit() after with actual
 */

import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import type { UsageHandler } from "@convex-dev/agent";
import { components } from "../_generated/api";

const internal = require("../_generated/api").internal as any;

// ============================================================
// Rate Limiter Configuration
// ============================================================

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // ──────────────────────────────────────────────────────────
  // Authentication rate limits
  // ──────────────────────────────────────────────────────────
  login: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 5,
  },

  failedLogin: {
    kind: "token bucket",
    rate: 3,
    period: 15 * MINUTE,
    capacity: 5,
  },

  signup: {
    kind: "fixed window",
    rate: 3,
    period: HOUR,
  },

  passwordReset: {
    kind: "fixed window",
    rate: 3,
    period: HOUR,
  },

  // ──────────────────────────────────────────────────────────
  // API rate limits
  // ──────────────────────────────────────────────────────────
  api: {
    kind: "token bucket",
    rate: 100,
    period: MINUTE,
    capacity: 20,
  },

  // ──────────────────────────────────────────────────────────
  // AI request rate limits (per-user)
  // Controls how often users can trigger AI generations
  // ──────────────────────────────────────────────────────────
  aiRequest: {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },

  // ──────────────────────────────────────────────────────────
  // AI token usage (per-user)
  // Token bucket allows burst, then gradual refill
  // Prevents single user from consuming all bandwidth
  // ──────────────────────────────────────────────────────────
  aiTokenUsage: {
    kind: "token bucket",
    rate: 50_000,
    period: MINUTE,
    capacity: 10_000,
    shards: 10, // ~25 QPS expected, 10 shards handles it
  },

  // ──────────────────────────────────────────────────────────
  // AI token usage (global)
  // Stays under provider API limits without mid-request errors
  // Higher sharding for high concurrent load
  // ──────────────────────────────────────────────────────────
  globalAiTokenUsage: {
    kind: "token bucket",
    rate: 500_000,
    period: MINUTE,
    capacity: 100_000,
    shards: 50, // High throughput, ~100 QPS capacity
  },

  // ──────────────────────────────────────────────────────────
  // Message/chat rate limits
  // ──────────────────────────────────────────────────────────
  sendMessage: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },

  globalSendMessage: {
    kind: "token bucket",
    rate: 10_000,
    period: MINUTE,
    shards: 20,
  },

  // ──────────────────────────────────────────────────────────
  // Webhook rate limits (high throughput)
  // ──────────────────────────────────────────────────────────
  webhook: {
    kind: "token bucket",
    rate: 1000,
    period: MINUTE,
    capacity: 100,
    shards: 10,
  },

  // ──────────────────────────────────────────────────────────
  // Embedding rate limits
  // ──────────────────────────────────────────────────────────
  embedding: {
    kind: "token bucket",
    rate: 100,
    period: MINUTE,
    capacity: 20,
  },

  // ──────────────────────────────────────────────────────────
  // Document operations
  // ──────────────────────────────────────────────────────────
  documentCreate: {
    kind: "fixed window",
    rate: 50,
    period: MINUTE,
  },

  documentUpdate: {
    kind: "token bucket",
    rate: 100,
    period: MINUTE,
    capacity: 20,
  },
});

// ============================================================
// Type exports
// ============================================================

export type RateLimitName =
  | "login"
  | "failedLogin"
  | "signup"
  | "passwordReset"
  | "api"
  | "aiRequest"
  | "aiTokenUsage"
  | "globalAiTokenUsage"
  | "sendMessage"
  | "globalSendMessage"
  | "webhook"
  | "embedding"
  | "documentCreate"
  | "documentUpdate";

// ============================================================
// Agent UsageHandler for post-generation token tracking
// ============================================================

/**
 * Model pricing in microdollars per 1K tokens (input/output)
 * Updated: Jan 2025
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 2500, output: 10000 }, // $2.50/$10 per 1M
  "gpt-4o-mini": { input: 150, output: 600 }, // $0.15/$0.60 per 1M
  "gpt-4-turbo": { input: 10000, output: 30000 },
  "gpt-3.5-turbo": { input: 500, output: 1500 },
  // Anthropic
  "claude-3-5-sonnet": { input: 3000, output: 15000 },
  "claude-3-5-haiku": { input: 800, output: 4000 },
  "claude-3-opus": { input: 15000, output: 75000 },
  // OpenRouter (varies, using estimates)
  "openrouter/auto": { input: 1000, output: 3000 },
  // Default fallback
  default: { input: 1000, output: 3000 },
};

/**
 * Calculate cost in microdollars
 */
export function calculateCostMicros(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["default"];
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  return Math.round(inputCost + outputCost);
}

/**
 * Creates a UsageHandler for @convex-dev/agent that:
 * 1. Tracks token usage to database (per-user, per-thread)
 * 2. Enforces rate limits with reserve pattern
 * 3. Calculates and stores costs
 *
 * @example
 * ```ts
 * const agent = new Agent(components.agent, {
 *   name: "Saga",
 *   chat: openai("gpt-4o"),
 *   usageHandler: createUsageHandler(),
 * });
 * ```
 */
export function createUsageHandler(options?: {
  trackToDb?: boolean;
  projectIdResolver?: (threadId: string) => Promise<string | undefined>;
}): UsageHandler {
  const { trackToDb = true } = options ?? {};

  return async (ctx, args) => {
    const {
      userId,
      threadId,
      agentName,
      model,
      provider,
      usage,
    } = args;

    // 1. Enforce rate limits (reserve pattern allows temporary negative)
    if (userId) {
      await rateLimiter.limit(ctx, "aiTokenUsage", {
        key: userId,
        count: usage.totalTokens,
        reserve: true,
      });
    }

    await rateLimiter.limit(ctx, "globalAiTokenUsage", {
      count: usage.totalTokens,
      reserve: true,
    });

    // 2. Track to database (optional)
    if (trackToDb && userId) {
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const costMicros = calculateCostMicros(model, inputTokens, outputTokens);

      const runQuery = (ctx as any).runQuery as (
        query: unknown,
        args: Record<string, unknown>
      ) => Promise<unknown>;
      const billingMode = (await runQuery(
        (internal as any)["billingSettings"]["getBillingMode"],
        { userId }
      )) as "managed" | "byok";
      if (billingMode === "byok") {
        return;
      }

      // Resolve projectId from threadId if resolver provided
      let projectId: string | undefined;
      if (options?.projectIdResolver && threadId) {
        projectId = await options.projectIdResolver(threadId);
      } else if (threadId) {
        const thread = await ctx.runQuery((internal as any)["ai/threads"].getThread, {
          threadId,
        });
        projectId = thread?.projectId ?? undefined;
      }

      await ctx.runMutation((internal as any)["aiUsage"].trackUsage, {
        userId,
        projectId,
        threadId,
        agentName,
        provider,
        endpoint: agentName ?? "saga",
        model,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
        costMicros,
        billingMode,
        success: true,
      });
    }
  };
}

/**
 * Creates a UsageHandler with project ID resolution from sagaThreads table
 */
export function createSagaUsageHandler(): UsageHandler {
  return createUsageHandler({
    trackToDb: true,
    projectIdResolver: async (_threadId) => {
      // This will be resolved in the actual handler context
      // The implementation should query sagaThreads by threadId
      return undefined; // Placeholder - actual resolution happens in handler
    },
  });
}

// ============================================================
// Pre-flight check helpers for AI requests
// ============================================================

/**
 * Pre-flight rate limit checks before starting an AI request.
 * Call this in mutations before triggering AI generation.
 *
 * @example
 * ```ts
 * export const chat = mutation({
 *   handler: async (ctx, args) => {
 *     const userId = await getAuthUserId(ctx);
 *     await checkAiRateLimits(ctx, userId, args.prompt);
 *     // ... start AI generation
 *   },
 * });
 * ```
 */
export async function checkAiRateLimits(
  ctx: any,
  userId: string,
  prompt: string,
  options?: { contextTokens?: number }
) {
  // Check request frequency
  await rateLimiter.limit(ctx, "aiRequest", { key: userId, throws: true });

  // Estimate tokens and check (without consuming)
  const estimatedTokens = estimateTokenCount(prompt) + (options?.contextTokens ?? 0);

  await rateLimiter.check(ctx, "aiTokenUsage", {
    key: userId,
    count: estimatedTokens,
    reserve: true, // Reserve capacity
    throws: true,
  });

  await rateLimiter.check(ctx, "globalAiTokenUsage", {
    count: estimatedTokens,
    reserve: true,
    throws: true,
  });
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get client identifier from request headers
 */
export function getClientIdentifier(
  request: Request,
  userId?: string
): string {
  if (userId) {
    return `user:${userId}`;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retryAfter / 1000)),
      },
    }
  );
}

/**
 * Estimate token count for a string
 * ~4 characters per token for English text (conservative estimate)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Re-export isRateLimitError for client-side error handling
 */
export { isRateLimitError } from "@convex-dev/rate-limiter";
