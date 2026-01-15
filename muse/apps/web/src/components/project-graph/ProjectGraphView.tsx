import { useState, useCallback, useEffect, useMemo } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FileText, Network, Plus, Settings2 } from "lucide-react";
import { Button } from "@mythos/ui";
import { useMythosStore } from "../../stores";
import { useProjectGraph } from "../../hooks/useProjectGraph";
import { useProjectTypeRegistry } from "../../hooks/useProjectTypeRegistry";
import { ProjectGraphCanvas } from "./ProjectGraphCanvas";
import {
  ProjectGraphControls,
  type ProjectGraphTypeOption,
} from "./ProjectGraphControls";
import {
  getGraphEntityLabel,
  getRegistryEntityHexColor,
  type GraphEntityType,
} from "@mythos/core";

export function ProjectGraphView() {
  const setCanvasView = useMythosStore((s) => s.setCanvasView);
  const openModal = useMythosStore((s) => s.openModal);
  const registry = useProjectTypeRegistry();

  const allEntityTypes = useMemo(
    () => Object.keys(registry?.entityTypes ?? {}) as GraphEntityType[],
    [registry]
  );
  const allEntityTypesKey = useMemo(
    () => allEntityTypes.slice().sort().join(","),
    [allEntityTypes]
  );
  
  // Filter state - all visible by default
  const [visibleTypes, setVisibleTypes] = useState<Set<GraphEntityType>>(new Set());

  useEffect(() => {
    if (allEntityTypes.length === 0) return;
    setVisibleTypes((prev) => {
      if (prev.size === 0) {
        return new Set(allEntityTypes);
      }
      const next = new Set(prev);
      allEntityTypes.forEach((type) => {
        if (!next.has(type)) next.add(type);
      });
      return next;
    });
  }, [allEntityTypesKey, allEntityTypes]);

  // Layout reset key - increment to trigger re-layout
  const [layoutKey, setLayoutKey] = useState(0);

  // Get counts
  const { visibleEntityCount, visibleRelationshipCount } = useProjectGraph({
    visibleTypes,
    registry,
  });

  const typeOptions = useMemo<ProjectGraphTypeOption[]>(
    () =>
      allEntityTypes.map((type) => {
        const def = registry?.entityTypes[type];
        return {
          type,
          label: getGraphEntityLabel(registry, type),
          iconName: def?.icon,
          color: getRegistryEntityHexColor(registry, type),
        };
      }),
    [allEntityTypesKey, registry, allEntityTypes]
  );

  const handleToggleType = useCallback((type: GraphEntityType) => {
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

  const handleCreateEntity = useCallback(() => {
    openModal({ type: "entityForm", mode: "create" });
  }, [openModal]);

  const handleOpenRegistry = useCallback(() => {
    openModal({ type: "registryEditor" });
  }, [openModal]);

  // Reserved for entity profile feature
  const _handleOpenEntityProfile = useCallback((entityId: string) => {
    openModal({ type: "entityProfile", entityId });
  }, [openModal]);
  void _handleOpenEntityProfile;

  return (
    <div
      className="h-full flex flex-col bg-mythos-bg-primary relative"
      data-testid="project-graph-view"
    >
      {/* Header bar */}
      <div className="h-10 border-b border-mythos-border-default bg-mythos-bg-secondary flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-mythos-accent-primary" />
          <span className="text-sm font-medium text-mythos-text-primary">
            Project Graph
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateEntity}
            className="gap-1.5 text-xs"
            data-testid="project-graph-create-entity"
          >
            <Plus className="w-3.5 h-3.5" />
            New Entity
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenRegistry}
            className="gap-1.5 text-xs"
            data-testid="project-graph-registry"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Registry
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToEditor}
            className="gap-1.5 text-xs"
            data-testid="project-graph-back-to-editor"
          >
            <FileText className="w-3.5 h-3.5" />
            Editor
          </Button>
        </div>
      </div>

      {/* Graph container */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <ProjectGraphCanvas
            key={layoutKey}
            visibleTypes={visibleTypes}
            registry={registry}
          />
        </ReactFlowProvider>

        {/* Controls overlay */}
        <ProjectGraphControls
          visibleTypes={visibleTypes}
          onToggleType={handleToggleType}
          onResetLayout={handleResetLayout}
          entityCount={visibleEntityCount}
          relationshipCount={visibleRelationshipCount}
          typeOptions={typeOptions}
        />
      </div>

      {/* Empty state */}
      {visibleEntityCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Network className="w-12 h-12 text-mythos-text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-mythos-text-muted">
              No entities in your project yet.
            </p>
            <p className="text-xs text-mythos-text-muted/70 mt-1">
              Create entities to see them here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
