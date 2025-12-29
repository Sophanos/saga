/**
 * useSearch Hook
 *
 * Orchestrates semantic search across documents and entities using
 * DeepInfra embeddings + Qdrant vector search.
 *
 * Features:
 * - Debounced auto-search on query change
 * - Abort in-flight requests on new search
 * - Support for semantic search via Qdrant
 * - "Find similar" for entity-seeded search
 * - Error handling with user-friendly messages
 */

import { useCallback, useEffect, useRef } from "react";
import {
  useMythosStore,
  type SearchMode,
  type SearchScope,
  type SearchResults,
  type DocumentSearchHit,
  type EntitySearchHit,
} from "../stores";
import {
  searchViaEdge,
  SearchApiError,
  type SemanticResult,
} from "../services/ai";
import type { Entity } from "@mythos/core";

/**
 * Options for the useSearch hook
 */
export interface UseSearchOptions {
  /** Enable auto-search on query change (default: true) */
  autoSearch?: boolean;
  /** Debounce delay in ms (default: 400) */
  debounceMs?: number;
  /** Enable the hook (default: true) */
  enabled?: boolean;
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Enable reranking for better results (default: true) */
  rerank?: boolean;
  /** Top K results after reranking (default: 10) */
  rerankTopK?: number;
}

/**
 * Return type for the useSearch hook
 */
export interface UseSearchResult {
  /** Execute a search with optional overrides */
  runSearch: (override?: {
    query?: string;
    mode?: SearchMode;
    scope?: SearchScope;
  }) => Promise<void>;
  /** Find entities/documents similar to a given entity */
  findSimilarToEntity: (entityId: string) => Promise<void>;
  /** Clear search state */
  clear: () => void;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<UseSearchOptions> = {
  autoSearch: true,
  debounceMs: 400,
  enabled: true,
  limit: 20,
  rerank: true,
  rerankTopK: 10,
};

/**
 * Format entity data for "find similar" search
 */
function formatEntityForSearch(entity: Entity): string {
  const parts: string[] = [
    `Name: ${entity.name}`,
    `Type: ${entity.type}`,
  ];

  if (entity.aliases && entity.aliases.length > 0) {
    parts.push(`Aliases: ${entity.aliases.join(", ")}`);
  }

  const notes = (entity as Record<string, unknown>).notes;
  if (typeof notes === "string" && notes.trim()) {
    parts.push(`Notes: ${notes}`);
  }

  return parts.join("\n");
}

/**
 * Transform semantic results to store format
 */
function transformResults(results: SemanticResult[]): SearchResults {
  const documents: DocumentSearchHit[] = [];
  const entities: EntitySearchHit[] = [];

  for (const result of results) {
    if (result.type === "document") {
      documents.push({
        id: result.documentId || result.id,
        title: result.title,
        type: "scene", // Default type; could be enhanced with actual type from payload
        score: result.rerankScore ?? result.vectorScore,
        scoreKind: result.rerankScore ? "combined" : "similarity",
        preview: result.preview,
      });
    } else {
      entities.push({
        id: result.entityId || result.id,
        name: result.title,
        type: (result.entityType as Entity["type"]) || "character",
        score: result.rerankScore ?? result.vectorScore,
        scoreKind: "similarity",
        preview: result.preview,
      });
    }
  }

  return { documents, entities };
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof SearchApiError) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return "Search service not configured. Please contact support.";
      case "RATE_LIMITED":
        return "Too many searches. Please wait a moment and try again.";
      case "VALIDATION_ERROR":
        return error.message;
      default:
        return `Search failed: ${error.message}`;
    }
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return ""; // Don't show error for aborted requests
    }
    return `Search failed: ${error.message}`;
  }

  return "An unexpected error occurred during search.";
}

/**
 * Hook for semantic search functionality
 */
export function useSearch(options?: UseSearchOptions): UseSearchResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Store state and actions
  const currentProject = useMythosStore((s) => s.project.currentProject);
  const searchQuery = useMythosStore((s) => s.search.query);
  const searchMode = useMythosStore((s) => s.search.mode);
  const searchScope = useMythosStore((s) => s.search.scope);
  const entities = useMythosStore((s) => s.world.entities);

  const setSearching = useMythosStore((s) => s.setSearching);
  const setSearchResults = useMythosStore((s) => s.setSearchResults);
  const setSearchError = useMythosStore((s) => s.setSearchError);
  const clearSearch = useMythosStore((s) => s.clearSearch);

  // Refs for debounce and abort
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Execute search
   */
  const executeSearch = useCallback(
    async (query: string, mode: SearchMode, scope: SearchScope) => {
      const projectId = currentProject?.id;
      if (!projectId) {
        setSearchError("No project selected.");
        return;
      }

      if (!query.trim()) {
        setSearchResults({ documents: [], entities: [] });
        return;
      }

      // Abort any in-flight request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setSearching(true);

      try {
        // For now, we only support semantic search via Qdrant
        // Fulltext and hybrid modes could be added later using Supabase RPCs
        const response = await searchViaEdge(
          {
            query: query.trim(),
            projectId,
            scope: scope === "all" ? undefined : scope,
            limit: opts.limit,
            rerank: opts.rerank,
            rerankTopK: opts.rerankTopK,
          },
          { signal: abortController.signal }
        );

        // Check if aborted
        if (abortController.signal.aborted) {
          return;
        }

        const results = transformResults(response.results);
        setSearchResults(results, { kind: "query" });
      } catch (error) {
        // Ignore aborted requests
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const message = getErrorMessage(error);
        if (message) {
          setSearchError(message);
        }
      }
    },
    [currentProject?.id, opts.limit, opts.rerank, opts.rerankTopK, setSearching, setSearchResults, setSearchError]
  );

  /**
   * Run search with optional overrides
   */
  const runSearch = useCallback(
    async (override?: {
      query?: string;
      mode?: SearchMode;
      scope?: SearchScope;
    }) => {
      const query = override?.query ?? searchQuery;
      const mode = override?.mode ?? searchMode;
      const scope = override?.scope ?? searchScope;

      await executeSearch(query, mode, scope);
    },
    [searchQuery, searchMode, searchScope, executeSearch]
  );

  /**
   * Find similar entities/documents based on an entity
   */
  const findSimilarToEntity = useCallback(
    async (entityId: string) => {
      const entity = entities.get(entityId);
      if (!entity) {
        setSearchError(`Entity not found: ${entityId}`);
        return;
      }

      const projectId = currentProject?.id;
      if (!projectId) {
        setSearchError("No project selected.");
        return;
      }

      // Abort any in-flight request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setSearching(true);

      try {
        const seedText = formatEntityForSearch(entity);

        const response = await searchViaEdge(
          {
            query: seedText,
            projectId,
            limit: opts.limit,
            rerank: true,
            rerankTopK: 5,
          },
          { signal: abortController.signal }
        );

        if (abortController.signal.aborted) {
          return;
        }

        // Filter out the source entity from results
        const filteredResults = response.results.filter(
          (r) => !(r.type === "entity" && (r.entityId === entityId || r.id === entityId))
        );

        const results = transformResults(filteredResults);
        setSearchResults(results, { kind: "entity", entityId });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const message = getErrorMessage(error);
        if (message) {
          setSearchError(message);
        }
      }
    },
    [entities, currentProject?.id, opts.limit, setSearching, setSearchResults, setSearchError]
  );

  /**
   * Clear search
   */
  const clear = useCallback(() => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    clearSearch();
  }, [clearSearch]);

  /**
   * Auto-search effect with debounce
   */
  useEffect(() => {
    if (!opts.enabled || !opts.autoSearch) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is empty
    if (!searchQuery.trim()) {
      return;
    }

    // Set debounce timer
    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(searchQuery, searchMode, searchScope);
    }, opts.debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [opts.enabled, opts.autoSearch, opts.debounceMs, searchQuery, searchMode, searchScope, executeSearch]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    runSearch,
    findSimilarToEntity,
    clear,
  };
}
