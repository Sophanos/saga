import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { marked } from "marked";
import type { ArtifactEnvelopeByType } from "@mythos/core";
import type { ArtifactOp } from "@mythos/state";
import { toPng, toSvg } from "html-to-image";
import type { ArtifactExportResult, ArtifactRendererHandle } from "./ArtifactRuntime";

marked.setOptions({ gfm: true, breaks: false });

type ProseArtifactEnvelope = Extract<
  ArtifactEnvelopeByType,
  { type: "prose" | "dialogue" | "lore" | "code" | "map" }
>;

interface ArtifactProseProps {
  envelope: ProseArtifactEnvelope;
  focusId: string | null;
  onApplyOp?: (op: ArtifactOp) => void;
}

function ArtifactProseComponent(
  { envelope, focusId, onApplyOp }: ArtifactProseProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => {
    return envelope.data.blockOrder
      .map((blockId) => envelope.data.blocksById[blockId])
      .filter(Boolean);
  }, [envelope.data.blockOrder, envelope.data.blocksById]);

  const blockClassName = useMemo(() => {
    if (envelope.type === "code") {
      return "prose prose-sm prose-invert max-w-none font-mono text-xs";
    }

    if (envelope.type === "dialogue") {
      return "prose prose-sm prose-invert max-w-none prose-p:leading-relaxed";
    }

    return "prose prose-sm prose-invert max-w-none";
  }, [envelope.type]);

  useEffect(() => {
    if (!focusId || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-element-id="${focusId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-mythos-accent/60");
      setTimeout(() => el.classList.remove("ring-2", "ring-mythos-accent/60"), 1200);
    }
  }, [focusId]);

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
          console.warn("[ArtifactProse] SVG export failed, falling back to PNG", error);
        }
      }
      const dataUrl = await toPng(containerRef.current);
      return { format: "png", dataUrl };
    },
    [envelope]
  );

  const handleFocus = useCallback((elementId: string) => {
    const el = containerRef.current?.querySelector(
      `[data-element-id="${elementId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    exportArtifact: handleExport,
    focusElement: handleFocus,
  }), [handleExport, handleFocus]);

  const handleBlockEdit = useCallback(
    (blockId: string, newMarkdown: string) => {
      onApplyOp?.({ type: "prose.block.replace", blockId, markdown: newMarkdown });
    },
    [onApplyOp]
  );

  return (
    <div ref={containerRef} className="space-y-3">
      {blocks.map((block) => (
        <div
          key={block.blockId}
          data-element-id={block.blockId}
          className={blockClassName}
          dangerouslySetInnerHTML={{ __html: String(marked.parse(block.markdown)) }}
          onDoubleClick={onApplyOp ? () => {
            const newText = prompt("Edit block:", block.markdown);
            if (newText !== null && newText !== block.markdown) {
              handleBlockEdit(block.blockId, newText);
            }
          } : undefined}
        />
      ))}
    </div>
  );
}

export const ArtifactProse = forwardRef(ArtifactProseComponent);
