/**
 * Billing Snapshot
 *
 * Provides subscription + usage data for the billing dashboard.
 */

import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getActiveSubscription } from "./lib/entitlements";
import {
  dbToTierConfig,
  getTierDefaults,
  type TierConfig,
  type TierId,
} from "./lib/tierConfig";
import { resolveTierFromSubscription } from "./lib/billingCore";

export type BillingTier = TierId;

export type BillingSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface BillingSubscriptionSnapshot {
  subscription: {
    tier: BillingTier;
    status: BillingSubscriptionStatus;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  billingMode: "managed" | "byok";
  preferredModel?: string;
  usage: {
    tokensUsed: number;
    tokensIncluded: number;
    tokensRemaining: number;
    wordsWritten: number;
  };
  period?: {
    start: string;
    end: string;
  };
  limits?: BillingSnapshotLimits;
  usageDetail?: BillingUsageDetail;
}

interface BillingSnapshotLimits {
  ai: {
    tokensPerMonth: number | null;
    callsPerDay: number;
    concurrentRequests: number;
  };
  memory: {
    retentionDays: number | null;
    maxPerProject: number;
    maxPinned: number;
  };
  embeddings: {
    operationsPerDay: number;
    maxVectorsPerProject: number;
  };
}

interface BillingMemoryUsage {
  used: number;
  limit: number;
  pinnedUsed: number;
  pinnedLimit: number;
}

interface BillingVectorUsage {
  used: number;
  limit: number;
  unavailable?: boolean;
}

interface BillingUsageDetail {
  memories?: BillingMemoryUsage;
  vectors?: BillingVectorUsage;
}

type SubscriptionRecord = {
  productId: string;
  entitlements?: string[];
  status: string;
  expiresAt?: number;
  willRenew: boolean;
  purchasedAt: number;
};

type MemoryRecord = {
  expiresAt?: number | null;
  pinned: boolean;
};

// ============================================================
// Internal Query
// ============================================================

export const getBillingSubscriptionSnapshot = internalQuery({
  args: {
    userId: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<BillingSubscriptionSnapshot> => {
    const nowMs = Date.now();
    const periodStartMs = getBillingPeriodStartMs(nowMs);
    const periodEndMs = getBillingPeriodEndMs(nowMs);

    const subscription = await getLatestSubscription(ctx, args.userId);
    const tier = resolveTierFromSubscription({
      entitlements: subscription?.entitlements,
      productId: subscription?.productId,
    });
    const billingSettings = await getBillingSettings(ctx, args.userId);
    const billingMode = billingSettings.billingMode;
    const preferredModel = billingMode === "byok" ? billingSettings.preferredModel : undefined;
    const tierConfig = await getTierConfig(ctx, tier);

    const usageCounters = await getUsageCounters(ctx, args.userId, periodStartMs);

    const tokensUsed =
      billingMode === "managed" ? usageCounters.tokensUsedManaged : 0;
    const tokensIncluded =
      billingMode === "managed" ? tierConfig.ai.tokensPerMonth ?? 0 : 0;
    const tokensRemaining = calculateTokensRemaining(tokensIncluded, tokensUsed);

    let usageDetail: BillingUsageDetail | undefined;
    if (args.projectId) {
      const projectId = args.projectId;
      await assertProjectAccess(ctx, args.userId, projectId);
      const memories = await ctx.db
        .query("memories")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
      usageDetail = {
        memories: buildMemoryUsage(memories, nowMs, tierConfig),
      };
    }

    return {
      subscription: {
        tier,
        status: normalizeSubscriptionStatus(subscription?.status),
        currentPeriodEnd: subscription?.expiresAt
          ? new Date(subscription.expiresAt).toISOString()
          : null,
        cancelAtPeriodEnd: subscription ? !subscription.willRenew : false,
      },
      billingMode,
      preferredModel,
      usage: {
        tokensUsed,
        tokensIncluded,
        tokensRemaining,
        wordsWritten: 0,
      },
      period: {
        start: new Date(periodStartMs).toISOString(),
        end: new Date(periodEndMs).toISOString(),
      },
      limits: buildLimits(tierConfig),
      usageDetail,
    };
  },
});

export const getBillingUsageCounters = internalQuery({
  args: {
    userId: v.string(),
    periodStartMs: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("billingUsagePeriods")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", args.userId).eq("periodStartMs", args.periodStartMs)
      )
      .first();
  },
});

// ============================================================
// Helpers
// ============================================================

function normalizeSubscriptionStatus(
  status?: string | null
): BillingSubscriptionStatus {
  if (!status) return "active";

  const normalized = status.toLowerCase();

  switch (normalized) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "paused":
      return "paused";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "unpaid":
      return "unpaid";
    case "grace_period":
      return "active";
    case "expired":
      return "canceled";
    default:
      return "canceled";
  }
}

function calculateTokensRemaining(tokensIncluded: number, tokensUsed: number): number {
  if (tokensIncluded === 0) return 0;
  return Math.max(tokensIncluded - tokensUsed, 0);
}

function getBillingPeriodStartMs(referenceMs: number): number {
  const now = new Date(referenceMs);
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function getBillingPeriodEndMs(referenceMs: number): number {
  const now = new Date(referenceMs);
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

function buildLimits(tierConfig: TierConfig): BillingSnapshotLimits {
  return {
    ai: {
      tokensPerMonth: tierConfig.ai.tokensPerMonth,
      callsPerDay: tierConfig.ai.callsPerDay,
      concurrentRequests: tierConfig.ai.concurrentRequests,
    },
    memory: {
      retentionDays: tierConfig.memory.retentionDays,
      maxPerProject: tierConfig.memory.maxPerProject,
      maxPinned: tierConfig.memory.maxPinned,
    },
    embeddings: {
      operationsPerDay: tierConfig.embeddings.operationsPerDay,
      maxVectorsPerProject: tierConfig.embeddings.maxVectorsPerProject,
    },
  };
}

function buildMemoryUsage(
  memories: MemoryRecord[],
  nowMs: number,
  tierConfig: TierConfig
): BillingMemoryUsage {
  const activeMemories = memories.filter(
    (memory) => !memory.expiresAt || memory.expiresAt > nowMs
  );
  const pinnedMemories = activeMemories.filter((memory) => memory.pinned);

  return {
    used: activeMemories.length,
    limit: tierConfig.memory.maxPerProject,
    pinnedUsed: pinnedMemories.length,
    pinnedLimit: tierConfig.memory.maxPinned,
  };
}

async function getLatestSubscription(
  ctx: QueryCtx,
  userId: string
): Promise<SubscriptionRecord | null> {
  const active = await getActiveSubscription(ctx, userId);
  if (active) return active as SubscriptionRecord;

  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  if (subscriptions.length === 0) {
    return null;
  }

  const sorted = subscriptions.sort((a, b) => b.purchasedAt - a.purchasedAt);
  return sorted[0] as SubscriptionRecord;
}

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

async function getBillingSettings(
  ctx: QueryCtx,
  userId: string
): Promise<{ billingMode: "managed" | "byok"; preferredModel: string }> {
  const record = await ctx.db
    .query("userBillingSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return {
    billingMode: record?.billingMode === "byok" ? "byok" : "managed",
    preferredModel: record?.preferredModel ?? DEFAULT_MODEL,
  };
}

async function getTierConfig(ctx: QueryCtx, tier: TierId): Promise<TierConfig> {
  const record = await ctx.db
    .query("tierConfigs")
    .withIndex("by_tier", (q) => q.eq("tier", tier))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();
  if (!record) {
    return getTierDefaults(tier);
  }
  return dbToTierConfig(record as any);
}

async function getUsageCounters(
  ctx: QueryCtx,
  userId: string,
  periodStartMs: number
): Promise<{ tokensUsedManaged: number; callsUsed: number }> {
  const record = await ctx.db
    .query("billingUsagePeriods")
    .withIndex("by_user_period", (q) =>
      q.eq("userId", userId).eq("periodStartMs", periodStartMs)
    )
    .first();

  if (record) {
    return {
      tokensUsedManaged: record.tokensUsedManaged,
      callsUsed: record.callsUsed,
    };
  }

  const usageRecords = await ctx.db
    .query("aiUsage")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).gte("createdAt", periodStartMs)
    )
    .collect();

  const tokensUsedManaged = usageRecords.reduce(
    (sum, record) => sum + record.totalTokens,
    0
  );
  return { tokensUsedManaged, callsUsed: usageRecords.length };
}

async function assertProjectAccess(
  ctx: QueryCtx,
  userId: string,
  projectId: Id<"projects">
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.ownerId === userId) {
    return;
  }

  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) =>
      q.eq("projectId", projectId).eq("userId", userId)
    )
    .unique();

  if (!member) {
    throw new Error("Access denied");
  }
}
