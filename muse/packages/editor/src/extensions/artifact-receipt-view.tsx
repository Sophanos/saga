import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useMemo } from "react";
import type {
  ArtifactReceiptAttrs,
  ArtifactReceiptSource,
  ArtifactReceiptStaleness,
} from "./artifact-receipt";

function formatTimestamp(timestampMs: number | undefined): string | null {
  if (!timestampMs) return null;
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function normalizeStaleness(value: unknown): ArtifactReceiptStaleness | undefined {
  if (value === "fresh" || value === "stale" || value === "missing" || value === "external") {
    return value;
  }
  return undefined;
}

function normalizeSources(value: unknown): ArtifactReceiptSource[] {
  if (!Array.isArray(value)) return [];
  const sources: ArtifactReceiptSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const type = typeof record["type"] === "string" ? (record["type"] as string) : "";
    const id = typeof record["id"] === "string" ? (record["id"] as string) : "";
    if (!type || !id) continue;
    sources.push({
      type,
      id,
      title: typeof record["title"] === "string" ? (record["title"] as string) : undefined,
      status: normalizeStaleness(record["status"]),
    });
  }
  return sources;
}

function stalenessBadgeStyles(staleness: ArtifactReceiptStaleness | undefined): { background: string; color: string } {
  switch (staleness) {
    case "stale":
      return { background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b" };
    case "missing":
      return { background: "rgba(239, 68, 68, 0.18)", color: "#ef4444" };
    case "external":
      return { background: "rgba(148, 163, 184, 0.18)", color: "#94a3b8" };
    case "fresh":
    default:
      return { background: "rgba(16, 185, 129, 0.16)", color: "#10b981" };
  }
}

function formatSourceLabel(source: ArtifactReceiptSource): string {
  const title = source.title?.trim();
  if (title) return title;
  return source.id;
}

export function ArtifactReceiptNodeView(props: NodeViewProps): JSX.Element {
  const attrs = props.node.attrs as unknown as ArtifactReceiptAttrs;

  const artifactKey = typeof attrs.artifactKey === "string" ? attrs.artifactKey : "";
  const artifactId = typeof attrs.artifactId === "string" ? attrs.artifactId : undefined;
  const title = typeof attrs.title === "string" ? attrs.title : undefined;
  const artifactType = typeof attrs.artifactType === "string" ? attrs.artifactType : undefined;
  const createdBy = typeof attrs.createdBy === "string" ? attrs.createdBy : undefined;
  const createdAt = typeof attrs.createdAt === "number" ? attrs.createdAt : undefined;
  const updatedAt = typeof attrs.updatedAt === "number" ? attrs.updatedAt : undefined;

  const staleness = useMemo(() => normalizeStaleness(attrs.staleness), [attrs.staleness]);
  const sources = useMemo(() => normalizeSources(attrs.sources), [attrs.sources]);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (artifactType) parts.push(artifactType);
    if (createdBy) parts.push(`by ${createdBy}`);
    const createdAtLabel = formatTimestamp(createdAt);
    if (createdAtLabel) parts.push(`created ${createdAtLabel}`);
    const updatedAtLabel = formatTimestamp(updatedAt);
    if (updatedAtLabel) parts.push(`updated ${updatedAtLabel}`);
    return parts.join(" · ");
  }, [artifactType, createdAt, createdBy, updatedAt]);

  const badge = useMemo(() => stalenessBadgeStyles(staleness), [staleness]);

  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      data-artifact-key={artifactKey}
      style={{
        border: "1px solid rgba(148, 163, 184, 0.22)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(15, 23, 42, 0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: "18px", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title?.trim() ? title : "Artifact receipt"}
            </div>
            <span
              style={{
                fontSize: 11,
                lineHeight: "14px",
                padding: "2px 8px",
                borderRadius: 999,
                background: badge.background,
                color: badge.color,
              }}
            >
              {staleness ?? "fresh"}
            </span>
          </div>
          {subtitle ? (
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(148, 163, 184, 0.95)" }}>
              {subtitle}
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontSize: 10, color: "rgba(148, 163, 184, 0.8)" }}>
            Key: {artifactKey}
            {artifactId ? ` · ID: ${artifactId}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              if (!artifactKey) return;
              window.dispatchEvent(new CustomEvent("artifact:open", { detail: { artifactKey } }));
            }}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.22)",
              background: "transparent",
              color: "rgba(226, 232, 240, 0.95)",
              cursor: "pointer",
            }}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => {
              if (!artifactKey) return;
              window.dispatchEvent(
                new CustomEvent("artifact:receipt:refresh", { detail: { artifactKey, artifactId } })
              );
            }}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.22)",
              background: "transparent",
              color: "rgba(226, 232, 240, 0.8)",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(226, 232, 240, 0.85)" }}>
          Sources
        </div>
        {sources.length === 0 ? (
          <div style={{ marginTop: 6, fontSize: 11, color: "rgba(148, 163, 184, 0.95)" }}>
            No sources recorded.
          </div>
        ) : (
          <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
            {sources.map((source) => (
              <li key={`${source.type}:${source.id}`} style={{ fontSize: 11, color: "rgba(226, 232, 240, 0.88)" }}>
                <span style={{ color: "rgba(148, 163, 184, 0.9)" }}>{source.type}:</span>{" "}
                {formatSourceLabel(source)}
                {source.status ? (
                  <span style={{ marginLeft: 8, color: "rgba(148, 163, 184, 0.9)" }}>
                    ({source.status})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </NodeViewWrapper>
  );
}

