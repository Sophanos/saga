/**
 * Unified Inbox API
 *
 * Aggregates all attention-worthy items into a single query:
 * - Pulse: Ambient signals from pulseSignals table
 * - Changes: Knowledge PRs from knowledgeSuggestions table
 * - Activity: Widget executions from widgetExecutions table
 * - Artifacts: Stale artifacts from artifacts table
 *
 * The Inbox shows "what needs attention now" — not history.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// =============================================================================
// Types
// =============================================================================

export type InboxItemType = "pulse" | "change" | "activity" | "artifact";

export interface InboxPulseItem {
  type: "pulse";
  id: string;
  signalType: string;
  title: string;
  description?: string;
  context?: string;
  confidence?: number;
  targetDocumentId?: string;
  targetEntityId?: string;
  status: string;
  read: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InboxChangeItem {
  type: "change";
  id: string;
  operation: string;
  targetType: string;
  targetId?: string;
  title: string;
  preview?: unknown;
  riskLevel?: string;
  status: string;
  toolCallId: string;
  actorName?: string;
  read: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InboxActivityItem {
  type: "activity";
  id: string;
  executionId: string;
  widgetId: string;
  title: string;
  status: string;
  statusText: string;
  documentId?: string;
  documentName?: string;
  read: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InboxArtifactItem {
  type: "artifact";
  id: string;
  artifactId: string;
  artifactKey?: string;
  title: string;
  artifactType: string;
  status: string;
  isStale: boolean;
  lastSyncedAt?: number;
  sourceUpdatedAt?: number;
  read: boolean;
  createdAt: number;
  updatedAt: number;
}

export type InboxItem =
  | InboxPulseItem
  | InboxChangeItem
  | InboxActivityItem
  | InboxArtifactItem;

// =============================================================================
// Queries
// =============================================================================

/**
 * Get all inbox data for a project.
 * Returns items grouped by type, each with counts.
 */
export const getInboxData = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 50 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        pulse: { items: [], unreadCount: 0 },
        changes: { items: [], pendingCount: 0 },
        activity: { items: [], runningCount: 0, needsAttentionCount: 0 },
        artifacts: { items: [], staleCount: 0 },
        totalUnread: 0,
      };
    }

    // Fetch pulse signals (unread and recent read)
    const pulseSignals = await ctx.db
      .query("pulseSignals")
      .withIndex("by_project_createdAt", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(limit);

    const pulseItems: InboxPulseItem[] = pulseSignals
      .filter((s) => s.status !== "dismissed")
      .map((s) => ({
        type: "pulse" as const,
        id: s._id,
        signalType: s.signalType,
        title: s.title,
        description: s.description,
        context: s.context,
        confidence: s.confidence,
        targetDocumentId: s.targetDocumentId,
        targetEntityId: s.targetEntityId,
        status: s.status,
        read: s.status !== "unread",
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

    // Fetch knowledge suggestions (pending approval)
    const suggestions = await ctx.db
      .query("knowledgeSuggestions")
      .withIndex("by_project_status_createdAt", (q) =>
        q.eq("projectId", projectId).eq("status", "proposed")
      )
      .order("desc")
      .take(limit);

    const changeItems: InboxChangeItem[] = suggestions.map((s) => ({
      type: "change" as const,
      id: s._id,
      operation: s.operation,
      targetType: s.targetType,
      targetId: s.targetId,
      title: formatChangeTitle(s.operation, s.targetType, s.proposedPatch),
      preview: s.preview,
      riskLevel: s.riskLevel,
      status: s.status,
      toolCallId: s.toolCallId,
      actorName: s.actorName,
      read: false, // Proposed changes are always "unread" until resolved
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    // Fetch widget executions (recent)
    const executions = await ctx.db
      .query("widgetExecutions")
      .withIndex("by_project_startedAt", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(limit);

    // Get document names for executions
    const docIds = executions
      .filter((e) => e.documentId)
      .map((e) => e.documentId!);
    const docs = await Promise.all(docIds.map((id) => ctx.db.get(id)));
    const docNameMap = new Map(
      docs.filter(Boolean).map((d) => [d!._id, d!.title])
    );

    const activityItems: InboxActivityItem[] = executions.map((e) => ({
      type: "activity" as const,
      id: e._id,
      executionId: e._id,
      widgetId: e.widgetId,
      title: formatWidgetLabel(e.widgetId),
      status: mapWidgetStatus(e.status),
      statusText: e.status,
      documentId: e.documentId,
      documentName: e.documentId ? docNameMap.get(e.documentId) : undefined,
      read: e.status === "done" || e.status === "error",
      createdAt: e.startedAt,
      updatedAt: e.completedAt ?? e.startedAt,
    }));

    // Fetch artifacts (check for staleness)
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_project_updatedAt", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(limit);

    const artifactItems: InboxArtifactItem[] = artifacts.map((a) => {
      // Check staleness: artifact is stale if any source has been updated
      // after the artifact was last synced
      const lastSourceUpdate = a.sources.reduce(
        (max, s) => Math.max(max, s.sourceUpdatedAt ?? 0),
        0
      );
      const isStale = lastSourceUpdate > a.updatedAt;

      return {
        type: "artifact" as const,
        id: a._id,
        artifactId: a._id,
        artifactKey: a.artifactKey,
        title: a.title,
        artifactType: a.type,
        status: a.status,
        isStale,
        lastSyncedAt: a.updatedAt,
        sourceUpdatedAt: lastSourceUpdate > 0 ? lastSourceUpdate : undefined,
        read: !isStale,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });

    // Calculate counts
    const pulseUnread = pulseItems.filter((i) => !i.read).length;
    const changesPending = changeItems.length;
    const activityRunning = activityItems.filter(
      (i) => i.status === "running"
    ).length;
    const activityNeedsAttention = activityItems.filter(
      (i) => i.status === "ready" || i.status === "failed"
    ).length;
    const artifactsStale = artifactItems.filter((i) => i.isStale).length;

    return {
      pulse: {
        items: pulseItems,
        unreadCount: pulseUnread,
      },
      changes: {
        items: changeItems,
        pendingCount: changesPending,
      },
      activity: {
        items: activityItems,
        runningCount: activityRunning,
        needsAttentionCount: activityNeedsAttention,
      },
      artifacts: {
        items: artifactItems,
        staleCount: artifactsStale,
      },
      totalUnread:
        pulseUnread + changesPending + activityNeedsAttention + artifactsStale,
    };
  },
});

/**
 * Get inbox counts only (for badge display).
 */
export const getInboxCounts = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        pulse: 0,
        changes: 0,
        activity: 0,
        artifacts: 0,
        total: 0,
        hasRunning: false,
      };
    }

    // Count unread pulse signals
    const pulseSignals = await ctx.db
      .query("pulseSignals")
      .withIndex("by_project_status_createdAt", (q) =>
        q.eq("projectId", projectId).eq("status", "unread")
      )
      .collect();

    // Count pending knowledge suggestions
    const suggestions = await ctx.db
      .query("knowledgeSuggestions")
      .withIndex("by_project_status_createdAt", (q) =>
        q.eq("projectId", projectId).eq("status", "proposed")
      )
      .collect();

    // Count recent activity needing attention
    const executions = await ctx.db
      .query("widgetExecutions")
      .withIndex("by_project_startedAt", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(50);

    const needsAttention = executions.filter(
      (e) => e.status === "preview" || e.status === "error"
    ).length;
    const hasRunning = executions.some(
      (e) =>
        e.status === "gathering" ||
        e.status === "generating" ||
        e.status === "formatting"
    );

    // Count stale artifacts (simplified check)
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_project_updatedAt", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(50);

    const staleCount = artifacts.filter((a) => {
      const lastSourceUpdate = a.sources.reduce(
        (max, s) => Math.max(max, s.sourceUpdatedAt ?? 0),
        0
      );
      return lastSourceUpdate > a.updatedAt;
    }).length;

    return {
      pulse: pulseSignals.length,
      changes: suggestions.length,
      activity: needsAttention,
      artifacts: staleCount,
      total: pulseSignals.length + suggestions.length + needsAttention + staleCount,
      hasRunning,
    };
  },
});

// =============================================================================
// Helpers
// =============================================================================

function formatChangeTitle(
  operation: string,
  targetType: string,
  proposedPatch: unknown
): string {
  const patch = proposedPatch as Record<string, unknown> | undefined;
  const name = patch?.name ?? patch?.text ?? "";

  switch (operation) {
    case "create_entity":
      return `Create ${targetType}: ${name}`;
    case "update_entity":
      return `Update ${targetType}: ${name}`;
    case "delete_entity":
      return `Delete ${targetType}: ${name}`;
    case "create_relationship":
      return `Add relationship`;
    case "update_relationship":
      return `Update relationship`;
    case "delete_relationship":
      return `Remove relationship`;
    case "create_memory":
      return `Add memory: ${typeof name === "string" ? name.slice(0, 30) : ""}...`;
    case "update_memory":
      return `Update memory`;
    case "delete_memory":
      return `Remove memory`;
    default:
      return `${operation} on ${targetType}`;
  }
}

function formatWidgetLabel(widgetId: string): string {
  // Convert widget ID to human-readable label
  return widgetId
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapWidgetStatus(
  status: string
): "running" | "ready" | "applied" | "failed" {
  switch (status) {
    case "idle":
    case "done":
      return "applied";
    case "gathering":
    case "generating":
    case "formatting":
      return "running";
    case "preview":
      return "ready";
    case "error":
      return "failed";
    default:
      return "running";
  }
}
