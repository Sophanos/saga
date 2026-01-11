import { useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@mythos/editor";
import { Button, cn } from "@mythos/ui";
import { api } from "../../../../../convex/_generated/api";

interface ExecutionMarkerOverlayProps {
  editor: Editor | null;
  projectId: string | null;
}

interface ActiveMarkerState {
  executionId: string;
  rect: DOMRect;
}

interface MarkerRange {
  from: number;
  to: number;
}

function getTextNodeSize(node: ProseMirrorNode): number {
  return node.text?.length ?? node.nodeSize;
}

function findExecutionMarkerRange(
  doc: ProseMirrorNode,
  executionId: string
): MarkerRange | null {
  let from = Number.POSITIVE_INFINITY;
  let to = -1;

  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (!node.isText || node.marks.length === 0) return;
    const hasMarker = node.marks.some(
      (mark) => mark.type.name === "executionMarker" && mark.attrs?.executionId === executionId
    );
    if (!hasMarker) return;

    const size = getTextNodeSize(node);
    from = Math.min(from, pos);
    to = Math.max(to, pos + size);
  });

  if (!Number.isFinite(from) || to < 0) {
    return null;
  }

  return { from, to };
}

function buildOverlayPosition(rect: DOMRect): { top: number; left: number } {
  const left = rect.left + rect.width / 2;
  const top = rect.top - 10;
  return { top, left };
}

export function ExecutionMarkerOverlay({
  editor,
  projectId,
}: ExecutionMarkerOverlayProps): JSX.Element | null {
  const convex = useConvex();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLElement | null>(null);

  const [active, setActive] = useState<ActiveMarkerState | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = useMemo(() => {
    if (!active) return null;
    return buildOverlayPosition(active.rect);
  }, [active]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      markerRef.current = null;
      setActive(null);
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (overlayRef.current && target && overlayRef.current.contains(target)) {
        return;
      }

      if (!target || !editor.view.dom.contains(target)) {
        if (markerRef.current) {
          markerRef.current = null;
          setActive(null);
        }
        return;
      }

      const marker = target.closest(".execution-marker") as HTMLElement | null;
      if (!marker) {
        if (markerRef.current) {
          markerRef.current = null;
          setActive(null);
        }
        return;
      }

      const executionId = marker.getAttribute("data-execution-id");
      if (!executionId) {
        return;
      }

      if (markerRef.current !== marker) {
        markerRef.current = marker;
        setError(null);
        setActive({ executionId, rect: marker.getBoundingClientRect() });
      }
    };

    document.addEventListener("mousemove", handlePointerMove);
    return () => {
      document.removeEventListener("mousemove", handlePointerMove);
    };
  }, [editor]);

  useEffect(() => {
    if (!active) return;

    const updatePosition = () => {
      const marker = markerRef.current;
      if (!marker || !document.body.contains(marker)) {
        markerRef.current = null;
        setActive(null);
        return;
      }

      setActive((prev) => {
        if (!prev) return prev;
        return { ...prev, rect: marker.getBoundingClientRect() };
      });
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [active?.executionId]);

  const handleRevert = async () => {
    if (!editor || editor.isDestroyed || !active) return;

    setIsReverting(true);
    setError(null);

    try {
      if (!projectId) {
        throw new Error("Project not available");
      }

      const result = await convex.query((api as any).widgetExecutions.getForRevert, {
        executionId: active.executionId,
      });

      const range = findExecutionMarkerRange(editor.state.doc, active.executionId);
      if (!range) {
        throw new Error("Unable to locate applied text");
      }

      const currentText = editor.state.doc.textBetween(range.from, range.to, "\n");
      if (result.appliedText && currentText !== result.appliedText) {
        const confirmed = window.confirm(
          "This text has changed since it was applied. Revert anyway?"
        );
        if (!confirmed) {
          return;
        }
      }

      editor
        .chain()
        .focus()
        .insertContentAt({ from: range.from, to: range.to }, result.originalText)
        .run();
      editor.commands.removeExecutionMarkerById(active.executionId);
      markerRef.current = null;
      setActive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revert");
    } finally {
      setIsReverting(false);
    }
  };

  if (!active || !position) return null;

  return (
    <div
      ref={overlayRef}
      data-execution-overlay
      data-testid="execution-marker-overlay"
      className={cn(
        "fixed z-50 px-2 py-1 rounded-md shadow-lg border",
        "bg-mythos-bg-secondary border-mythos-border-default",
        "text-xs text-mythos-text-primary"
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-mythos-text-muted">
          Applied
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRevert}
          disabled={isReverting}
          data-testid="execution-marker-revert"
        >
          {isReverting ? "Reverting..." : "Revert"}
        </Button>
      </div>
      {error && (
        <div className="text-[10px] text-mythos-accent-red mt-1 max-w-[220px]">
          {error}
        </div>
      )}
    </div>
  );
}
