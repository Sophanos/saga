/**
 * Hook for managing tree expansion state.
 */

import { useState, useCallback, useMemo } from "react";
import type { TreeExpansionState } from "../types";

/**
 * Hook to manage which tree nodes are expanded.
 *
 * @param defaultExpanded - Array of node IDs that should be expanded initially
 * @returns Tree expansion state and actions
 */
export function useTreeExpansion(
  defaultExpanded: string[] = []
): TreeExpansionState {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(defaultExpanded)
  );

  const isExpanded = useCallback(
    (id: string) => expandedIds.has(id),
    [expandedIds]
  );

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expand = useCallback((id: string) => {
    setExpandedIds((prev: Set<string>) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const collapse = useCallback((id: string) => {
    setExpandedIds((prev: Set<string>) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    // This needs to be called with all expandable IDs
    // For now, it's a no-op - consumer should provide all IDs
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return useMemo(
    () => ({
      expandedIds,
      isExpanded,
      toggle,
      expand,
      collapse,
      expandAll,
      collapseAll,
    }),
    [expandedIds, isExpanded, toggle, expand, collapse, expandAll, collapseAll]
  );
}
