/**
 * E2E Test Harness (guarded by E2E_TEST_MODE + E2E_TEST_SECRET)
 *
 * Provides deterministic fixtures and admin helpers for Playwright tests.
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { retrieveRAGContext } from "./ai/rag";
import { canAccessFeature, getUserTier } from "./lib/entitlements";

const DEFAULT_SCENARIO = "default";

interface DetectionFixtureEntity {
  name: string;
  type: string;
  aliases: string[];
  confidence: number;
  properties: Record<string, unknown>;
}

interface DetectionFixtureStats {
  totalFound: number;
  byType: Record<string, number>;
}

interface DetectionFixtureResult {
  entities: DetectionFixtureEntity[];
  stats: DetectionFixtureStats;
}

function assertE2EAccess(secret: string): void {
  if (process.env["E2E_TEST_MODE"] !== "true") {
    throw new Error("E2E test mode is disabled");
  }
  const expected = process.env["E2E_TEST_SECRET"];
  if (!expected) {
    throw new Error("E2E_TEST_SECRET not configured");
  }
  if (secret !== expected) {
    throw new Error("Forbidden");
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const upsertE2EUser = internalMutation({
  args: {
    secret: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    assertE2EAccess(args.secret);

    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("Email is required");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      if (!existing.emailVerificationTime) {
        await ctx.db.patch(existing._id, { emailVerificationTime: now });
      }
      return existing._id as string;
    }

    const userId = await ctx.db.insert("users", {
      email,
      name: args.name?.trim() || undefined,
      emailVerificationTime: now,
    });

    return userId as string;
  },
});

/**
 * E2E-only sign-in helper.
 *
 * Magic-link auth is not automatable in Playwright without an email inbox.
 * This action creates (or reuses) a user by email and issues a fresh JWT + refresh token.
 */
export const signInForE2E = action({
  args: {
    secret: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertE2EAccess(args.secret);

    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("Email is required");
    }

    const userId = (await ctx.runMutation((internal as any).e2e.upsertE2EUser, {
      secret: args.secret,
      email,
      name: args.name,
    })) as string;

    const sessionInfo = (await ctx.runMutation((internal as any).auth.store, {
      args: {
        type: "signIn",
        userId: userId as any,
        generateTokens: true,
      },
    })) as { userId: string; sessionId: string; tokens: { token: string; refreshToken: string } | null };

    if (!sessionInfo?.tokens) {
      throw new Error("Failed to issue auth tokens for E2E");
    }

    return {
      userId: sessionInfo.userId,
      sessionId: sessionInfo.sessionId,
      token: sessionInfo.tokens.token,
      refreshToken: sessionInfo.tokens.refreshToken,
    };
  },
});

function buildDetectionStats(entities: DetectionFixtureEntity[]): DetectionFixtureStats {
  const byType: Record<string, number> = {};
  for (const entity of entities) {
    byType[entity.type] = (byType[entity.type] ?? 0) + 1;
  }
  return { totalFound: entities.length, byType };
}

export const setDetectionFixture = mutation({
  args: {
    secret: v.string(),
    projectId: v.id("projects"),
    key: v.optional(v.string()),
    entities: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        aliases: v.array(v.string()),
        confidence: v.number(),
        properties: v.any(),
      })
    ),
    stats: v.optional(
      v.object({
        totalFound: v.number(),
        byType: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    assertE2EAccess(args.secret);

    const now = Date.now();
    const key = args.key ?? DEFAULT_SCENARIO;
    const existing = await ctx.db
      .query("e2eDetectionFixtures")
      .withIndex("by_project_key", (q) => q.eq("projectId", args.projectId).eq("key", key))
      .first();

    const stats = args.stats ?? buildDetectionStats(args.entities as DetectionFixtureEntity[]);

    if (existing) {
      await ctx.db.patch(existing._id, {
        entities: args.entities,
        stats,
        updatedAt: now,
      });
      return { id: existing._id };
    }

    const id = await ctx.db.insert("e2eDetectionFixtures", {
      projectId: args.projectId,
      key,
      entities: args.entities,
      stats,
      createdAt: now,
      updatedAt: now,
    });

    return { id };
  },
});

export const clearDetectionFixture = mutation({
  args: {
    secret: v.string(),
    projectId: v.id("projects"),
    key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertE2EAccess(args.secret);
    const key = args.key ?? DEFAULT_SCENARIO;
    const existing = await ctx.db
      .query("e2eDetectionFixtures")
      .withIndex("by_project_key", (q) => q.eq("projectId", args.projectId).eq("key", key))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { success: true };
  },
});

export const getDetectionFixture = internalQuery({
  args: {
    projectId: v.id("projects"),
    key: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DetectionFixtureResult | null> => {
    const key = args.key ?? DEFAULT_SCENARIO;
    const existing = await ctx.db
      .query("e2eDetectionFixtures")
      .withIndex("by_project_key", (q) => q.eq("projectId", args.projectId).eq("key", key))
      .first();
    if (!existing) return null;

    const entities = existing.entities as DetectionFixtureEntity[];
    const stats = (existing.stats as DetectionFixtureStats | undefined) ?? buildDetectionStats(entities);

    return { entities, stats };
  },
});

export const setSagaScript = mutation({
  args: {
    secret: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    scenario: v.optional(v.string()),
    steps: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    assertE2EAccess(args.secret);
    const now = Date.now();
    const scenario = args.scenario ?? DEFAULT_SCENARIO;

    const existing = await ctx.db
      .query("e2eSagaScripts")
      .withIndex("by_project_user_scenario", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId).eq("scenario", scenario)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        steps: args.steps,
        updatedAt: now,
      });
      return { id: existing._id };
    }

    const id = await ctx.db.insert("e2eSagaScripts", {
      projectId: args.projectId,
      userId: args.userId,
      scenario,
      steps: args.steps,
      createdAt: now,
      updatedAt: now,
    });

    return { id };
  },
});

export const clearSagaScript = mutation({
  args: {
    secret: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    scenario: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertE2EAccess(args.secret);
    const scenario = args.scenario ?? DEFAULT_SCENARIO;
    const existing = await ctx.db
      .query("e2eSagaScripts")
      .withIndex("by_project_user_scenario", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId).eq("scenario", scenario)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { success: true };
  },
});

export const getSagaScript = internalQuery({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    scenario: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ steps: unknown[] } | null> => {
    const scenario = args.scenario ?? DEFAULT_SCENARIO;
    const script = await ctx.db
      .query("e2eSagaScripts")
      .withIndex("by_project_user_scenario", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId).eq("scenario", scenario)
      )
      .first();
    if (!script) return null;
    return { steps: script.steps as unknown[] };
  },
});

export const getDocumentForE2E = query({
  args: {
    secret: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    contentText: string | null;
    updatedAt: number | null;
    wordCount: number | null;
    title: string | null;
  } | null> => {
    assertE2EAccess(args.secret);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    return {
      contentText: doc.contentText ?? null,
      updatedAt: doc.updatedAt ?? null,
      wordCount: doc.wordCount ?? null,
      title: doc.title ?? null,
    };
  },
});

export const processEmbeddingJobsNow = action({
  args: {
    secret: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertE2EAccess(args.secret);
    await ctx.runAction((internal as any)["ai/embeddings"].processEmbeddingJobs, {
      batchSize: args.batchSize,
    });
    return { success: true };
  },
});

export const retrieveRagContext = action({
  args: {
    secret: v.string(),
    projectId: v.id("projects"),
    query: v.string(),
  },
  handler: async (_ctx, args) => {
    assertE2EAccess(args.secret);
    return await retrieveRAGContext(args.query, args.projectId);
  },
});

const subscriptionStatus = v.union(
  v.literal("active"),
  v.literal("trialing"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("expired"),
  v.literal("paused"),
  v.literal("grace_period")
);

const subscriptionStore = v.union(
  v.literal("APP_STORE"),
  v.literal("MAC_APP_STORE"),
  v.literal("PLAY_STORE"),
  v.literal("STRIPE"),
  v.literal("PROMOTIONAL")
);

export const upsertSubscription = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    status: subscriptionStatus,
    productId: v.string(),
    entitlements: v.array(v.string()),
    store: v.optional(subscriptionStore),
    revenuecatId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    purchasedAt: v.optional(v.number()),
    isTrialPeriod: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertE2EAccess(args.secret);

    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const payload = {
      userId: args.userId,
      revenuecatId: args.revenuecatId ?? args.userId,
      status: args.status,
      store: args.store ?? "STRIPE",
      productId: args.productId,
      entitlements: args.entitlements,
      purchasedAt: args.purchasedAt ?? now,
      expiresAt: args.expiresAt,
      gracePeriodExpiresAt: undefined as number | undefined,
      canceledAt: args.status === "canceled" ? now : undefined,
      willRenew: args.status === "active",
      isTrialPeriod: args.isTrialPeriod ?? false,
      trialExpiresAt: args.isTrialPeriod ? args.expiresAt : undefined,
      priceInCents: undefined as number | undefined,
      currency: undefined as string | undefined,
      lastSyncedAt: now,
      rawEvent: { source: "e2e" },
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { id: existing._id };
    }

    const id = await ctx.db.insert("subscriptions", payload);
    return { id };
  },
});

export const getUserTierForE2E = query({
  args: {
    secret: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    assertE2EAccess(args.secret);
    return getUserTier(ctx, args.userId);
  },
});

export const canAccessFeatureForE2E = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    feature: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    assertE2EAccess(args.secret);
    return canAccessFeature(
      ctx,
      args.userId,
      args.feature as Parameters<typeof canAccessFeature>[2]
    );
  },
});
