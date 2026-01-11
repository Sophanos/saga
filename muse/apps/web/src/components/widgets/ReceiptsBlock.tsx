import { useMemo } from "react";
import type { ArtifactManifestDraft, ArtifactSourceRef } from "@mythos/agent-protocol";
import { cn } from "@mythos/ui";

interface ReceiptsBlockProps {
  manifest: ArtifactManifestDraft | null;
  className?: string;
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

export function ReceiptsBlock({ manifest, className }: ReceiptsBlockProps) {
  const sources = manifest?.sources ?? [];
  const grouped = useMemo(() => groupSources(sources), [sources]);
  const hasSources = sources.length > 0;

  return (
    <div
      className={cn("rounded-lg border border-mythos-border-default bg-mythos-bg-primary/60", className)}
      data-testid="widget-receipts"
    >
      <div className="px-3 py-2 border-b border-mythos-border-default">
        <span className="text-xs uppercase tracking-wide text-mythos-text-muted">Receipts</span>
      </div>
      <div className="px-3 py-2">
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
