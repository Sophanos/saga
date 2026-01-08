/**
 * Hook for managing tree selection state.
 */

import { useState, useCallback, useMemo } from "react";
import type { TreeSelectionState } from "../types";

/**
 * Hook to manage which tree node is selected.
 *
 * @param defaultSelectedId - Initially selected node ID
 * @returns Tree selection state and actions
 */
export function useTreeSelection(
  defaultSelectedId: string | null = null
): TreeSelectionState {
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedId === id,
    [selectedId]
  );

  return useMemo(
    () => ({
      selectedId,
      select,
      isSelected,
    }),
    [selectedId, select, isSelected]
  );
}
