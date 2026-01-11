import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Button, cn } from "@mythos/ui";
import type { ArtifactManifestDraft } from "@mythos/agent-protocol";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { useCurrentProject, useMythosStore } from "../../stores";
import { formatRelativeTime } from "../../utils/time";
import { ReceiptsBlock } from "../widgets/ReceiptsBlock";

type ArtifactDoc = Doc<"artifacts">;
type SourceStatus = "fresh" | "stale" | "missing";

function buildSourceStatusMap(
  sources: Array<{ type: string; id: string; status: SourceStatus }>
): Record<string, SourceStatus> {
  const map: Record<string, SourceStatus> = {};
  for (const source of sources) {
    map[`${source.type}:${source.id}`] = source.status;
  }
  return map;
}

function resolveManifest(artifact: ArtifactDoc | null): ArtifactManifestDraft | null {
  if (!artifact) return null;
  return {
    type: artifact.type,
    status: artifact.status,
    sources: artifact.sources,
    createdBy: artifact.createdBy,
    createdAt: artifact.createdAt,
    executionContext: artifact.executionContext,
  };
}

export function ArtifactsView(): JSX.Element {
  const project = useCurrentProject();
  const projectId = project?.id ?? null;
  const setCanvasView = useMythosStore((s) => s.setCanvasView);

  const artifacts = useQuery(
    (api as any).artifacts.list,
    projectId ? { projectId: projectId as Id<"projects">, limit: 200 } : "skip"
  ) as ArtifactDoc[] | undefined;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredArtifacts = useMemo(() => {
    if (!artifacts) return [];
    const trimmed = query.trim().toLowerCase();
    return artifacts.filter((artifact) => {
      if (typeFilter !== "all" && artifact.type !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all" && artifact.status !== statusFilter) {
        return false;
      }
      if (!trimmed) return true;
      return (
        artifact.title.toLowerCase().includes(trimmed) ||
        artifact.type.toLowerCase().includes(trimmed)
      );
    });
  }, [artifacts, query, statusFilter, typeFilter]);

  useEffect(() => {
    if (filteredArtifacts.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId) {
      setSelectedId(filteredArtifacts[0]._id);
      return;
    }
    const stillVisible = filteredArtifacts.some((artifact) => artifact._id === selectedId);
    if (!stillVisible) {
      setSelectedId(filteredArtifacts[0]._id);
    }
  }, [filteredArtifacts, selectedId]);

  const selectedArtifact = useMemo(() => {
    if (!selectedId) return null;
    return filteredArtifacts.find((artifact) => artifact._id === selectedId) ?? null;
  }, [filteredArtifacts, selectedId]);

  const staleness = useQuery(
    (api as any).artifacts.checkStaleness,
    selectedArtifact ? { artifactId: selectedArtifact._id } : "skip"
  );

  const sourceStatuses = useMemo(() => {
    if (!staleness?.sources) return undefined;
    return buildSourceStatusMap(staleness.sources);
  }, [staleness]);

  const manifest = useMemo(() => resolveManifest(selectedArtifact), [selectedArtifact]);

  const typeOptions = useMemo(() => {
    if (!artifacts) return [];
    return Array.from(new Set(artifacts.map((artifact) => artifact.type))).sort();
  }, [artifacts]);

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-mythos-text-muted">
        Select a project to view artifacts.
      </div>
    );
  }

  if (!artifacts) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-mythos-text-muted">
        Loading artifacts…
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-mythos-text-muted">
        <div>No artifacts yet.</div>
        <Button size="sm" variant="outline" onClick={() => setCanvasView("editor")}>
          Back to editor
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="w-72 border-r border-mythos-border-default bg-mythos-bg-secondary flex flex-col">
        <div className="p-3 space-y-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artifacts..."
            className="w-full bg-mythos-bg-primary border border-mythos-border-default rounded-md px-2 py-1 text-xs text-mythos-text-primary"
          />
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="flex-1 bg-mythos-bg-primary border border-mythos-border-default rounded-md px-2 py-1 text-xs text-mythos-text-secondary"
            >
              <option value="all">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="flex-1 bg-mythos-bg-primary border border-mythos-border-default rounded-md px-2 py-1 text-xs text-mythos-text-secondary"
            >
              <option value="all">All status</option>
              <option value="draft">Draft</option>
              <option value="manually_modified">Modified</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-3">
          {filteredArtifacts.length === 0 ? (
            <div className="px-3 py-2 text-xs text-mythos-text-muted">
              No matching artifacts.
            </div>
          ) : (
            filteredArtifacts.map((artifact) => {
              const isSelected = artifact._id === selectedId;
              return (
                <button
                  key={artifact._id}
                  onClick={() => setSelectedId(artifact._id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2",
                    "border border-transparent hover:border-mythos-border-default",
                    isSelected && "bg-mythos-bg-tertiary border-mythos-border-default"
                  )}
                >
                  <div className="text-sm text-mythos-text-primary truncate">{artifact.title}</div>
                  <div className="text-xs text-mythos-text-muted">
                    {artifact.type} · {formatRelativeTime(new Date(artifact.updatedAt))}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {selectedArtifact ? (
          <>
            <div className="space-y-1">
              <div className="text-lg font-medium text-mythos-text-primary">
                {selectedArtifact.title}
              </div>
              <div className="text-xs text-mythos-text-muted">
                {selectedArtifact.type} · {selectedArtifact.status} ·{" "}
                {formatRelativeTime(new Date(selectedArtifact.updatedAt))}
              </div>
            </div>

            <pre className="whitespace-pre-wrap text-sm text-mythos-text-primary bg-mythos-bg-primary/60 border border-mythos-border-default rounded-lg p-4">
              {selectedArtifact.content}
            </pre>

            <ReceiptsBlock
              manifest={manifest}
              artifactId={selectedArtifact._id}
              editable
              stalenessStatus={staleness?.status}
              sourceStatuses={sourceStatuses}
            />
          </>
        ) : (
          <div className="text-sm text-mythos-text-muted">
            Select an artifact to view details.
          </div>
        )}
      </div>
    </div>
  );
}
