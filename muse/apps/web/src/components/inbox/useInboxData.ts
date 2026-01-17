/**
 * Inbox Data Hook
 *
 * Syncs Convex inbox data to the client-side Zustand store.
 * Provides a unified interface for accessing inbox items.
 */

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  useInboxStore,
  type PulseSignal,
  type ChangeItem,
  type InboxActivityItem,
  type InboxArtifactItem,
} from "@mythos/state";

interface UseInboxDataOptions {
  projectId: Id<"projects"> | null;
  enabled?: boolean;
}

export function useInboxData({ projectId, enabled = true }: UseInboxDataOptions) {
  const setPulseItems = useInboxStore((s) => s.setPulseItems);
  const setChangeItems = useInboxStore((s) => s.setChangeItems);
  const setActivityItems = useInboxStore((s) => s.setActivityItems);
  const setArtifactItems = useInboxStore((s) => s.setArtifactItems);

  // Fetch inbox data from Convex
  const inboxData = useQuery(
    api.inbox.getInboxData,
    enabled && projectId ? { projectId } : "skip"
  );

  // Sync to Zustand store
  useEffect(() => {
    if (!inboxData) return;

    // Transform and set pulse items
    const pulseItems: PulseSignal[] = inboxData.pulse.items.map((item) => ({
      id: item.id,
      type: "pulse" as const,
      signalType: item.signalType as PulseSignal["signalType"],
      title: item.title,
      subtitle: item.description,
      context: item.context,
      confidence: item.confidence,
      targetType: item.targetDocumentId ? "document" : item.targetEntityId ? "entity" : undefined,
      targetId: item.targetDocumentId ?? item.targetEntityId,
      status: item.status === "unread" ? "ready" : "applied",
      read: item.read,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    setPulseItems(pulseItems);

    // Transform and set change items
    const changeItems: ChangeItem[] = inboxData.changes.items.map((item) => ({
      id: item.id,
      type: "change" as const,
      title: item.title,
      subtitle: item.actorName ? `by ${item.actorName}` : undefined,
      operation: item.operation,
      targetType: item.targetType as "document" | "entity",
      targetId: item.targetId,
      riskLevel: item.riskLevel as ChangeItem["riskLevel"],
      toolCallId: item.toolCallId,
      status: item.status === "proposed" ? "proposed" : "ready",
      read: item.read,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    setChangeItems(changeItems);

    // Transform widget executions to activity items
    const widgetActivityItems: InboxActivityItem[] = inboxData.activity.items.map((item) => ({
      id: item.id,
      type: "activity" as const,
      executionId: item.executionId,
      widgetId: item.widgetId,
      title: item.title,
      statusText: item.statusText,
      documentId: item.documentId,
      documentName: item.documentName,
      projectId: projectId!,
      status: item.status as InboxActivityItem["status"],
      read: item.read,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Transform analysis jobs to activity items (merged into activity section)
    const analysisActivityItems: InboxActivityItem[] = (inboxData.analysis?.items ?? []).map((item) => ({
      id: `analysis-${item.id}`,
      type: "activity" as const,
      executionId: item.id,
      widgetId: `analysis:${item.kind}`, // Prefix to distinguish from widgets
      title: item.title,
      statusText: item.statusText,
      documentId: item.documentId,
      documentName: item.documentName,
      projectId: projectId!,
      status: item.status as InboxActivityItem["status"],
      read: item.read,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Combine and sort by updatedAt
    const activityItems = [...widgetActivityItems, ...analysisActivityItems].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    setActivityItems(activityItems);

    // Transform and set artifact items
    const artifactItems: InboxArtifactItem[] = inboxData.artifacts.items.map((item) => ({
      id: item.id,
      type: "artifact" as const,
      artifactId: item.artifactId,
      artifactKey: item.artifactKey,
      title: item.title,
      subtitle: item.artifactType,
      status: item.isStale ? "stale" : "applied",
      lastSyncedAt: item.lastSyncedAt,
      sourceUpdatedAt: item.sourceUpdatedAt,
      read: item.read,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    setArtifactItems(artifactItems);
  }, [inboxData, projectId, setPulseItems, setChangeItems, setActivityItems, setArtifactItems]);

  const analysisRunning = inboxData?.analysis?.runningCount ?? 0;
  const analysisNeedsAttention = inboxData?.analysis?.needsAttentionCount ?? 0;

  return {
    isLoading: inboxData === undefined,
    counts: inboxData
      ? {
          pulse: inboxData.pulse.unreadCount,
          changes: inboxData.changes.pendingCount,
          activity: inboxData.activity.needsAttentionCount + analysisNeedsAttention,
          artifacts: inboxData.artifacts.staleCount,
          total: inboxData.totalUnread,
          hasRunning: inboxData.activity.runningCount > 0 || analysisRunning > 0,
        }
      : {
          pulse: 0,
          changes: 0,
          activity: 0,
          artifacts: 0,
          total: 0,
          hasRunning: false,
        },
  };
}

/**
 * Get inbox counts only (for badge display without full data).
 */
export function useInboxCounts(projectId: Id<"projects"> | null) {
  const counts = useQuery(
    api.inbox.getInboxCounts,
    projectId ? { projectId } : "skip"
  );

  if (!counts) {
    return {
      pulse: 0,
      changes: 0,
      activity: 0,
      artifacts: 0,
      total: 0,
      hasRunning: false,
    };
  }

  // Merge analysis count into activity
  return {
    pulse: counts.pulse,
    changes: counts.changes,
    activity: counts.activity + (counts.analysis ?? 0),
    artifacts: counts.artifacts,
    total: counts.total,
    hasRunning: counts.hasRunning,
  };
}
