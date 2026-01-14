import { forwardRef, useEffect, useMemo, useRef } from "react";
import { DataSet } from "vis-data";
import { Timeline } from "vis-timeline/standalone";
import "vis-timeline/styles/vis-timeline-graph2d.min.css";
import { toPng } from "html-to-image";
import type { ArtifactEnvelopeByType, TimelineItem } from "@mythos/core";
import type { ArtifactOp } from "@mythos/state";
import type { ArtifactRendererHandle, ArtifactExportResult } from "./ArtifactRuntime";

interface ArtifactTimelineProps {
  envelope: Extract<ArtifactEnvelopeByType, { type: "timeline" }>;
  focusId: string | null;
  onApplyOp: (op: ArtifactOp) => void;
}

function ArtifactTimelineComponent(
  { envelope, focusId, onApplyOp }: ArtifactTimelineProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const itemsRef = useRef<DataSet<any> | null>(null);

  const groups = useMemo(() => {
    return envelope.data.groupOrder
      .map((groupId) => envelope.data.groupsById[groupId])
      .filter(Boolean)
      .map((group) => ({ id: group.groupId, content: group.label }));
  }, [envelope.data.groupOrder, envelope.data.groupsById]);

  const items = useMemo(() => {
    return envelope.data.itemOrder
      .map((itemId) => envelope.data.itemsById[itemId])
      .filter(Boolean)
      .map((item: TimelineItem) => ({
        id: item.itemId,
        content: item.storyTime ? `${item.content} (${item.storyTime})` : item.content,
        start: item.start,
        end: item.end,
        group: item.groupId,
      }));
  }, [envelope.data.itemOrder, envelope.data.itemsById]);

  useEffect(() => {
    if (!containerRef.current) return;

    const dataset = new DataSet(items);
    itemsRef.current = dataset;
    const timeline = new Timeline(containerRef.current, dataset, groups, {
      stack: true,
      editable: { updateTime: true, updateGroup: true, remove: false },
      margin: { item: 12 },
    });
    timelineRef.current = timeline;

    dataset.on("update", (_event: string, properties: { items: string[] }) => {
      for (const itemId of properties.items ?? []) {
        const updated = dataset.get(itemId) as { id: string; content: string; start: string; end?: string; group?: string } | null;
        if (!updated) continue;
        onApplyOp({
          type: "timeline.item.update",
          itemId: updated.id,
          updates: {
            itemId: updated.id,
            content: updated.content,
            start: updated.start,
            end: updated.end,
            groupId: updated.group,
          },
        });
      }
    });

    return () => {
      timeline.destroy();
    };
  }, [groups, items, onApplyOp]);

  useEffect(() => {
    if (!focusId || !timelineRef.current) return;
    timelineRef.current.focus(focusId, { animation: true });
  }, [focusId]);

  const handleExport = async (format: "png" | "svg" | "json"): Promise<ArtifactExportResult | null> => {
    if (format === "json") {
      return { format: "json", json: JSON.stringify(envelope, null, 2) };
    }
    if (!containerRef.current) return null;
    const dataUrl = await toPng(containerRef.current);
    return { format: "png", dataUrl };
  };

  const handleFocus = (elementId: string) => {
    timelineRef.current?.focus(elementId, { animation: true });
  };

  useEffect(() => {
    if (!ref || typeof ref === "function") return;
    ref.current = {
      exportArtifact: handleExport,
      focusElement: handleFocus,
    };
  }, [handleExport, handleFocus, ref]);

  return (
    <div className="h-[280px] rounded-lg border border-mythos-border-default bg-mythos-bg-secondary">
      <div ref={containerRef} className="h-full" />
    </div>
  );
}

export const ArtifactTimeline = forwardRef(ArtifactTimelineComponent);
