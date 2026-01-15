import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import type { ArtifactEnvelopeByType } from "@mythos/core";
import { toPng, toSvg } from "html-to-image";
import type { ArtifactExportResult, ArtifactRendererHandle } from "./ArtifactRuntime";

interface ArtifactEntityCardProps {
  envelope: Extract<ArtifactEnvelopeByType, { type: "entityCard" }>;
  focusId: string | null;
}

function ArtifactEntityCardComponent(
  { envelope }: ArtifactEntityCardProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(envelope.data.displayFields ?? {});

  const handleExport = useCallback(
    async (format: "png" | "svg" | "json"): Promise<ArtifactExportResult | null> => {
      if (format === "json") {
        return { format: "json", json: JSON.stringify(envelope, null, 2) };
      }
      if (!containerRef.current) return null;
      if (format === "svg") {
        try {
          const dataUrl = await toSvg(containerRef.current);
          return { format: "svg", dataUrl };
        } catch (error) {
          console.warn("[ArtifactEntityCard] SVG export failed, falling back to PNG", error);
        }
      }
      const dataUrl = await toPng(containerRef.current);
      return { format: "png", dataUrl };
    },
    [envelope]
  );

  const handleFocus = useCallback(() => undefined, []);

  useImperativeHandle(ref, () => ({
    exportArtifact: handleExport,
    focusElement: handleFocus,
  }), [handleExport, handleFocus]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-mythos-border-default bg-mythos-bg-secondary p-4 space-y-3"
    >
      <div className="text-xs text-mythos-text-muted">Entity Card</div>
      <div className="text-lg text-mythos-text-primary">{envelope.data.entityId}</div>
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 text-xs">
              <span className="text-mythos-text-muted">{key}</span>
              <span className="text-mythos-text-primary text-right">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </span>
            </div>
          ))}
        </div>
      )}
      {envelope.data.relatedEntityIds?.length ? (
        <div className="text-xs text-mythos-text-secondary">
          Related: {envelope.data.relatedEntityIds.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

export const ArtifactEntityCard = forwardRef(ArtifactEntityCardComponent);
