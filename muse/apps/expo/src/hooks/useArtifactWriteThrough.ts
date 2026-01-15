/**
 * useArtifactWriteThrough - Write-through sync hook for artifact persistence
 *
 * Watches for dirty artifacts with pending ops and flushes them to the server.
 * Handles retry logic, conflict detection, and error recovery.
 */

import { useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useArtifactStore, useProjectStore, type ArtifactOp } from "@mythos/state";

const FLUSH_INTERVAL_MS = 2000;
const MAX_RETRIES = 3;

interface FlushState {
  inProgress: Set<string>;
  retryCount: Map<string, number>;
}

export function useArtifactWriteThrough(): void {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const artifacts = useArtifactStore((s) => s.artifacts);
  const applyOpRemote = useMutation((api as any).artifacts.applyOp);
  const updateContentRemote = useMutation((api as any).artifacts.updateContent);

  const flushState = useRef<FlushState>({
    inProgress: new Set(),
    retryCount: new Map(),
  });

  const flushArtifactOps = useCallback(
    async (artifactId: string, ops: ArtifactOp[]): Promise<boolean> => {
      if (!projectId) return false;
      if (flushState.current.inProgress.has(artifactId)) return false;

      const { setSyncStatus, clearPendingOps, updateArtifact } = useArtifactStore.getState();

      flushState.current.inProgress.add(artifactId);
      setSyncStatus(artifactId, "syncing");

      try {
        // Apply each op sequentially to maintain order
        for (const op of ops) {
          const result = await applyOpRemote({
            projectId: projectId as Id<"projects">,
            artifactKey: artifactId,
            op,
          });

          // Update local content with server result
          if (result?.nextEnvelope) {
            updateArtifact(artifactId, {
              content: JSON.stringify(result.nextEnvelope, null, 2),
            });
          }
        }

        // Success - clear pending ops
        clearPendingOps(artifactId);
        flushState.current.retryCount.delete(artifactId);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Sync failed";
        const isRevMismatch = errorMessage.includes("test failed") || errorMessage.includes("rev");

        if (isRevMismatch) {
          // Conflict detected - need manual resolution
          setSyncStatus(artifactId, "error", "Content was modified elsewhere. Refresh to see latest.");
        } else {
          // Transient error - retry
          const retryCount = (flushState.current.retryCount.get(artifactId) ?? 0) + 1;
          flushState.current.retryCount.set(artifactId, retryCount);

          if (retryCount >= MAX_RETRIES) {
            setSyncStatus(artifactId, "error", `Sync failed after ${MAX_RETRIES} attempts`);
          } else {
            setSyncStatus(artifactId, "dirty");
          }
        }
        return false;
      } finally {
        flushState.current.inProgress.delete(artifactId);
      }
    },
    [projectId, applyOpRemote]
  );

  const flushPendingContent = useCallback(
    async (
      artifactId: string,
      pendingContent: { content: string; format: string }
    ): Promise<boolean> => {
      if (!projectId) return false;
      if (flushState.current.inProgress.has(artifactId)) return false;

      const { setSyncStatus, clearPendingOps } = useArtifactStore.getState();

      flushState.current.inProgress.add(artifactId);
      setSyncStatus(artifactId, "syncing");

      try {
        await updateContentRemote({
          projectId: projectId as Id<"projects">,
          artifactKey: artifactId,
          content: pendingContent.content,
          format: pendingContent.format,
        });

        clearPendingOps(artifactId);
        flushState.current.retryCount.delete(artifactId);
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Sync failed";
        const retryCount = (flushState.current.retryCount.get(artifactId) ?? 0) + 1;
        flushState.current.retryCount.set(artifactId, retryCount);

        if (retryCount >= MAX_RETRIES) {
          setSyncStatus(artifactId, "error", `Sync failed after ${MAX_RETRIES} attempts: ${errorMessage}`);
        } else {
          setSyncStatus(artifactId, "dirty");
        }
        return false;
      } finally {
        flushState.current.inProgress.delete(artifactId);
      }
    },
    [projectId, updateContentRemote]
  );

  // Periodic flush of dirty artifacts
  useEffect(() => {
    if (!projectId) return;

    const flush = () => {
      const currentArtifacts = useArtifactStore.getState().artifacts;

      for (const artifact of currentArtifacts) {
        if (artifact.sync?.status !== "dirty") continue;

        // Flush pending ops first
        const pendingOps = artifact.sync?.pendingOps;
        if (pendingOps && pendingOps.length > 0) {
          flushArtifactOps(artifact.id, pendingOps);
          continue;
        }

        // Then flush pending content
        const pendingContent = artifact.sync?.pendingContent;
        if (pendingContent) {
          flushPendingContent(artifact.id, pendingContent);
        }
      }
    };

    // Initial flush
    flush();

    // Periodic flush
    const interval = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [projectId, flushArtifactOps, flushPendingContent]);

  // Immediate flush when artifacts become dirty (debounced via interval)
  useEffect(() => {
    const dirtyArtifacts = artifacts.filter(
      (a) => a.sync?.status === "dirty" && a.projectId
    );

    if (dirtyArtifacts.length === 0) return;

    // The periodic flush will handle these
    // This effect just ensures we're watching for changes
  }, [artifacts]);
}
