import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import type { ArtifactManifestDraft, ArtifactSourceRef, ArtifactSourceType } from "@mythos/agent-protocol";
import { Button, cn } from "@mythos/ui";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentProject } from "../../stores";
import { SourcePickerModal } from "./SourcePickerModal";

type SourceStatus = "fresh" | "stale" | "missing";

interface ReceiptsBlockProps {
  manifest: ArtifactManifestDraft | null;
  className?: string;
  artifactId?: string;
  editable?: boolean;
  stalenessStatus?: SourceStatus;
  sourceStatuses?: Record<string, SourceStatus>;
}

function groupSources(sources: ArtifactSourceRef[]): Record<string, ArtifactSourceRef[]> {
  return sources.reduce<Record<string, ArtifactSourceRef[]>>((acc, source) => {
    const key = source.type;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(source);
    return acc;
  }, {});
}

function buildSourceKey(source: { type: string; id: string }): string {
  return `${source.type}:${source.id}`;
}

export function ReceiptsBlock({
  manifest,
  className,
  artifactId,
  editable = false,
  stalenessStatus,
  sourceStatuses,
}: ReceiptsBlockProps): JSX.Element {
  const project = useCurrentProject();
  const projectId = project?.id ?? null;
  const updateSources = useMutation(api.artifacts.updateSources);

  const [sources, setSources] = useState<ArtifactSourceRef[]>(manifest?.sources ?? []);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setSources(manifest?.sources ?? []);
  }, [manifest?.sources]);

  const grouped = useMemo(() => groupSources(sources), [sources]);
  const hasSources = sources.length > 0;
  const canEdit = editable && !!artifactId && !!projectId;

  const handleAddSources = useCallback(
    async (items: Array<{ type: ArtifactSourceType; id: string }>) => {
      if (!artifactId) return;
      setIsUpdating(true);
      setLocalError(null);
      try {
        const updated = await updateSources({ artifactId, add: items });
        setSources(updated);
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : "Failed to add sources");
      } finally {
        setIsUpdating(false);
      }
    },
    [artifactId, updateSources]
  );

  const handleRemoveSource = useCallback(
    async (source: ArtifactSourceRef) => {
      if (!artifactId) return;
      setIsUpdating(true);
      setLocalError(null);
      try {
        const updated = await updateSources({
          artifactId,
          remove: [{ type: source.type, id: source.id }],
        });
        setSources(updated);
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : "Failed to remove source");
      } finally {
        setIsUpdating(false);
      }
    },
    [artifactId, updateSources]
  );

  return (
    <div
      className={cn("rounded-lg border border-mythos-border-default bg-mythos-bg-primary/60", className)}
      data-testid="widget-receipts"
    >
      <div className="px-3 py-2 border-b border-mythos-border-default flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-mythos-text-muted">Receipts</span>
          {stalenessStatus === "stale" && (
            <span className="text-[10px] uppercase tracking-wide text-mythos-accent-amber">
              May be stale
            </span>
          )}
          {stalenessStatus === "missing" && (
            <span className="text-[10px] uppercase tracking-wide text-mythos-accent-red">
              Source missing
            </span>
          )}
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsPickerOpen(true)}
            disabled={isUpdating}
            data-testid="widget-receipts-add"
          >
            Add sources
          </Button>
        )}
      </div>
      <div className="px-3 py-2">
        {localError && (
          <div className="text-xs text-mythos-accent-red mb-2">{localError}</div>
        )}
        {!hasSources && (
          <div className="text-xs text-mythos-text-muted">No sources</div>
        )}
        {hasSources && (
          <div className="space-y-3">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="text-[11px] uppercase tracking-wide text-mythos-text-muted mb-1">
                  {type}
                </div>
                <div className="space-y-1">
                  {items.map((source) => (
                    <div key={`${source.type}-${source.id}`} className="flex items-center gap-2">
                      <span className="text-xs text-mythos-text-secondary truncate">
                        {source.title ?? source.id}
                      </span>
                      {source.manual && (
                        <span className="text-[10px] uppercase tracking-wide text-mythos-text-muted">
                          Manual
                        </span>
                      )}
                      {sourceStatuses?.[buildSourceKey(source)] === "stale" && (
                        <span className="text-[10px] uppercase tracking-wide text-mythos-accent-amber">
                          stale
                        </span>
                      )}
                      {sourceStatuses?.[buildSourceKey(source)] === "missing" && (
                        <span className="text-[10px] uppercase tracking-wide text-mythos-accent-red">
                          missing
                        </span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveSource(source)}
                          className="text-[10px] uppercase tracking-wide text-mythos-text-muted hover:text-mythos-text-secondary"
                          data-testid={`widget-receipts-remove-${source.id}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {canEdit && artifactId && projectId && (
        <SourcePickerModal
          isOpen={isPickerOpen}
          projectId={projectId}
          existingSources={sources}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={handleAddSources}
        />
      )}
    </div>
  );
}
