/**
 * Hook for managing manifest search state.
 */

import { useState, useCallback, useMemo } from "react";

export interface ManifestSearchState {
  /** Current search query */
  query: string;
  /** Set the search query */
  setQuery: (query: string) => void;
  /** Clear the search query */
  clear: () => void;
  /** Whether there's an active search */
  isSearching: boolean;
}

/**
 * Hook to manage manifest search state.
 *
 * @param defaultQuery - Initial search query
 * @returns Search state and actions
 */
export function useManifestSearch(
  defaultQuery: string = ""
): ManifestSearchState {
  const [query, setQueryState] = useState(defaultQuery);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
  }, []);

  const clear = useCallback(() => {
    setQueryState("");
  }, []);

  const isSearching = query.length > 0;

  return useMemo(
    () => ({
      query,
      setQuery,
      clear,
      isSearching,
    }),
    [query, setQuery, clear, isSearching]
  );
}
