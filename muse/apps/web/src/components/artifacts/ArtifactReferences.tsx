import { useCallback, useMemo } from "react";
import { cn, toast } from "@mythos/ui";
import { parseArtifactEnvelope } from "@mythos/core";
import type { Artifact } from "@mythos/state";
import { Copy, ExternalLink } from "lucide-react";

type ArtifactReference = {
  artifactId: string;
  elementId?: string;
  label?: string;
};

type Backlink = {
  sourceArtifactId: string;
  label?: string;
  elementId?: string;
};

export interface ArtifactReferencesProps {
  artifact: Artifact;
  artifacts: Artifact[];
  className?: string;
  onOpenArtifact: (artifactId: string, elementId?: string | null) => void;
}

function getArtifactReferences(artifact: Artifact): ArtifactReference[] {
  if (artifact.format !== "json") return [];
  try {
    const envelope = parseArtifactEnvelope(JSON.parse(artifact.content));
    return (envelope.references ?? []) as ArtifactReference[];
  } catch {
    return [];
  }
}

function buildArtifactTitleIndex(artifacts: Artifact[]): Record<string, string> {
  const index: Record<string, string> = {};
  for (const artifact of artifacts) {
    index[artifact.id] = artifact.title;
  }
  return index;
}

function buildArtifactLink(artifactId: string, elementId?: string): string {
  return elementId ? `artifact://${artifactId}#${elementId}` : `artifact://${artifactId}`;
}

export function ArtifactReferences({
  artifact,
  artifacts,
  className,
  onOpenArtifact,
}: ArtifactReferencesProps): JSX.Element | null {
  const titleById = useMemo(() => buildArtifactTitleIndex(artifacts), [artifacts]);

  const outgoing = useMemo(
    () => getArtifactReferences(artifact),
    [artifact.content, artifact.format]
  );

  const incoming = useMemo(() => {
    const backlinks: Backlink[] = [];
    for (const other of artifacts) {
      if (other.id === artifact.id) continue;

      const refs = getArtifactReferences(other);
      for (const ref of refs) {
        if (ref.artifactId !== artifact.id) continue;
        backlinks.push({
          sourceArtifactId: other.id,
          label: ref.label,
          elementId: ref.elementId,
        });
      }
    }
    return backlinks;
  }, [artifact.id, artifacts]);

  const hasAny = outgoing.length > 0 || incoming.length > 0;
  if (!hasAny) return null;

  const handleCopy = useCallback(async (artifactId: string, elementId?: string) => {
    const link = buildArtifactLink(artifactId, elementId);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Copied reference link");
    } catch {
      toast.error("Failed to copy link");
    }
  }, []);

  return (
    <div
      className={cn(
        "mt-4 rounded-lg border border-mythos-border-default bg-mythos-bg-tertiary/20",
        className
      )}
    >
      <div className="px-3 py-2 border-b border-mythos-border-default">
        <div className="text-xs uppercase tracking-wide text-mythos-text-muted">
          References
        </div>
      </div>

      <div className="px-3 py-2 space-y-4">
        {outgoing.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-mythos-text-muted">
              Outgoing
            </div>
            <div className="space-y-1">
              {outgoing.map((ref, index) => {
                const title = titleById[ref.artifactId] ?? ref.artifactId;
                const missing = !titleById[ref.artifactId];
                return (
                  <div
                    key={`${ref.artifactId}:${ref.elementId ?? "none"}:${index}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => onOpenArtifact(ref.artifactId, ref.elementId ?? null)}
                      className={cn(
                        "flex-1 text-left text-xs truncate hover:underline",
                        missing ? "text-mythos-text-muted" : "text-mythos-text-secondary"
                      )}
                      disabled={missing}
                      title={missing ? "Artifact not found" : title}
                    >
                      {ref.label ?? title}
                      {ref.elementId ? (
                        <span className="ml-1 text-mythos-text-muted">#{ref.elementId}</span>
                      ) : null}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(ref.artifactId, ref.elementId)}
                        className="p-1 rounded hover:bg-white/5 text-mythos-text-muted"
                        aria-label="Copy reference link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onOpenArtifact(ref.artifactId, ref.elementId ?? null)}
                        className="p-1 rounded hover:bg-white/5 text-mythos-text-muted"
                        aria-label="Open referenced artifact"
                        disabled={missing}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {incoming.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-mythos-text-muted">
              Backlinks
            </div>
            <div className="space-y-1">
              {incoming.map((link, index) => {
                const title = titleById[link.sourceArtifactId] ?? link.sourceArtifactId;
                return (
                  <div
                    key={`${link.sourceArtifactId}:${link.elementId ?? "none"}:${index}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => onOpenArtifact(link.sourceArtifactId, null)}
                      className="flex-1 text-left text-xs truncate hover:underline text-mythos-text-secondary"
                      title={title}
                    >
                      {title}
                      {link.label ? (
                        <span className="ml-1 text-mythos-text-muted">· {link.label}</span>
                      ) : null}
                      {link.elementId ? (
                        <span className="ml-1 text-mythos-text-muted">→ #{link.elementId}</span>
                      ) : null}
                    </button>

                    <div className="flex items-center gap-1">
                      {link.elementId ? (
                        <button
                          onClick={() => handleCopy(artifact.id, link.elementId)}
                          className="p-1 rounded hover:bg-white/5 text-mythos-text-muted"
                          aria-label="Copy link to referenced element"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => onOpenArtifact(link.sourceArtifactId, null)}
                        className="p-1 rounded hover:bg-white/5 text-mythos-text-muted"
                        aria-label="Open source artifact"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

