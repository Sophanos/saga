import { useCallback } from "react";
import type { Entity } from "@mythos/core";
import { useMythosStore } from "../stores";

export interface EntityClickPosition {
  x: number;
  y: number;
  elementRect: DOMRect;
}

export interface UseEntityClickOptions {
  /** Called before showing the HUD, can return false to prevent HUD */
  onBeforeShow?: (entity: Entity, position: EntityClickPosition) => boolean | void;
  /** Called after the HUD is shown */
  onAfterShow?: (entity: Entity, position: EntityClickPosition) => void;
}

/**
 * Hook for handling clicks on entity spans in the editor.
 *
 * Returns a click handler that:
 * 1. Extracts entity information from the clicked element
 * 2. Calculates click position for HUD placement
 * 3. Sets the selected entity in the store
 * 4. Shows the HUD at the appropriate position
 */
export function useEntityClick(options: UseEntityClickOptions = {}) {
  const entities = useMythosStore((state) => state.world.entities);
  const setSelectedEntity = useMythosStore((state) => state.setSelectedEntity);
  const showHud = useMythosStore((state) => state.showHud);

  const handleEntityClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      // Find the entity element (with data-entity-id attribute)
      const target = event.target as HTMLElement;
      const entityElement = target.closest("[data-entity-id]") as HTMLElement | null;

      if (!entityElement) {
        return;
      }

      const entityId = entityElement.getAttribute("data-entity-id");
      if (!entityId) {
        return;
      }

      const entity = entities.get(entityId);
      if (!entity) {
        console.warn(`Entity with id ${entityId} not found in store`);
        return;
      }

      // Calculate position from the clicked element
      const rect = entityElement.getBoundingClientRect();
      const position: EntityClickPosition = {
        x: rect.left + rect.width / 2, // Center horizontally on the element
        y: rect.bottom + 8, // Just below the element with a small gap
        elementRect: rect,
      };

      // Allow preventing the HUD from showing
      if (options.onBeforeShow) {
        const result = options.onBeforeShow(entity, position);
        if (result === false) {
          return;
        }
      }

      // Set selected entity and show HUD
      setSelectedEntity(entityId);
      showHud(entity, { x: position.x, y: position.y });

      // Callback after showing
      if (options.onAfterShow) {
        options.onAfterShow(entity, position);
      }

      // Prevent event from bubbling to other handlers
      event.stopPropagation();
    },
    [entities, setSelectedEntity, showHud, options]
  );

  const closeHud = useCallback(() => {
    showHud(null);
    setSelectedEntity(null);
  }, [showHud, setSelectedEntity]);

  return {
    handleEntityClick,
    closeHud,
  };
}
