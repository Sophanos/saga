import { useState, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FileText, Network } from "lucide-react";
import { Button } from "@mythos/ui";
import { useMythosStore } from "../../stores";
import { useWorldGraph } from "../../hooks/useWorldGraph";
import { WorldGraphCanvas } from "./WorldGraphCanvas";
import { WorldGraphControls } from "./WorldGraphControls";
import type { EntityType } from "@mythos/core";

// All entity types for the filter
const ALL_ENTITY_TYPES: EntityType[] = [
  "character",
  "location",
  "item",
  "magic_system",
  "faction",
  "event",
  "concept",
];

export function WorldGraphView() {
  const setCanvasView = useMythosStore((s) => s.setCanvasView);
  
  // Filter state - all visible by default
  const [visibleTypes, setVisibleTypes] = useState<Set<EntityType>>(
    new Set(ALL_ENTITY_TYPES)
  );

  // Layout reset key - increment to trigger re-layout
  const [layoutKey, setLayoutKey] = useState(0);

  // Get counts
  const { visibleEntityCount, visibleRelationshipCount } = useWorldGraph({ visibleTypes });

  const handleToggleType = useCallback((type: EntityType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleResetLayout = useCallback(() => {
    setLayoutKey((k) => k + 1);
  }, []);

  const handleBackToEditor = useCallback(() => {
    setCanvasView("editor");
  }, [setCanvasView]);

  return (
    <div
      className="h-full flex flex-col bg-mythos-bg-primary relative"
      data-testid="world-graph-view"
    >
      {/* Header bar */}
      <div className="h-10 border-b border-mythos-border-default bg-mythos-bg-secondary flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-mythos-accent-primary" />
          <span className="text-sm font-medium text-mythos-text-primary">
            World Graph
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToEditor}
          className="gap-1.5 text-xs"
          data-testid="world-graph-back-to-editor"
        >
          <FileText className="w-3.5 h-3.5" />
          Editor
        </Button>
      </div>

      {/* Graph container */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <WorldGraphCanvas
            key={layoutKey}
            visibleTypes={visibleTypes}
          />
        </ReactFlowProvider>

        {/* Controls overlay */}
        <WorldGraphControls
          visibleTypes={visibleTypes}
          onToggleType={handleToggleType}
          onResetLayout={handleResetLayout}
          entityCount={visibleEntityCount}
          relationshipCount={visibleRelationshipCount}
        />
      </div>

      {/* Empty state */}
      {visibleEntityCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Network className="w-12 h-12 text-mythos-text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-mythos-text-muted">
              No entities in your world yet.
            </p>
            <p className="text-xs text-mythos-text-muted/70 mt-1">
              Create characters, locations, and items to see them here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
