import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ArtifactEnvelopeByType } from "@mythos/core";
import type { ArtifactOp } from "@mythos/state";
import { toPng } from "html-to-image";
import type { ArtifactExportResult, ArtifactRendererHandle } from "./ArtifactRuntime";

interface ArtifactOutlineProps {
  envelope: Extract<ArtifactEnvelopeByType, { type: "outline" }>;
  focusId: string | null;
  onApplyOp?: (op: ArtifactOp) => void;
}

function ArtifactOutlineComponent(
  { envelope, focusId, onApplyOp }: ArtifactOutlineProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    return envelope.data.childrenByParentId;
  }, [envelope.data.childrenByParentId]);

  const itemsById = envelope.data.itemsById;

  const handleDrop = useCallback(
    (targetParentId: string, targetIndex: number) => {
      if (!draggedItem || !onApplyOp) return;
      onApplyOp({
        type: "outline.item.move",
        itemId: draggedItem,
        newParentId: targetParentId === "root" ? undefined : targetParentId,
        newIndex: targetIndex,
      });
      setDraggedItem(null);
    },
    [draggedItem, onApplyOp]
  );

  const renderList = (parentId: string, depth: number): JSX.Element | null => {
    const children = childrenByParent[parentId] ?? [];
    if (children.length === 0) return null;

    return (
      <div className="space-y-2">
        {children.map((itemId, index) => {
          const item = itemsById[itemId];
          if (!item) return null;
          return (
            <div key={item.itemId} className="space-y-1">
              <div
                data-element-id={item.itemId}
                draggable={!!onApplyOp}
                onDragStart={onApplyOp ? () => setDraggedItem(item.itemId) : undefined}
                onDragOver={onApplyOp ? (e) => e.preventDefault() : undefined}
                onDrop={onApplyOp ? () => handleDrop(parentId, index) : undefined}
                className="rounded-md border border-mythos-border-default bg-mythos-bg-secondary px-3 py-2 cursor-grab active:cursor-grabbing"
                style={{ marginLeft: depth * 12 }}
              >
                <div className="text-sm text-mythos-text-primary">{item.title}</div>
                {item.summary && (
                  <div className="text-xs text-mythos-text-muted">{item.summary}</div>
                )}
              </div>
              {renderList(item.itemId, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

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

  return (
    <div ref={containerRef} className="space-y-3">
      {renderList("root", 0)}
    </div>
  );
}

export const ArtifactOutline = forwardRef(ArtifactOutlineComponent);
