import { useState, useCallback, useRef } from "react";
import { useMythosStore } from "../stores";
import {
  importStory,
  type ImportOptions,
  type ImportResult,
  type ImportProgress,
} from "../services/import";
import { useApiKey } from "./useApiKey";

// ============================================================================
// Types
// ============================================================================

export interface UseStoryImporterResult {
  /** Import a story file with the given options */
  importStory: (
    file: File,
    options: Omit<ImportOptions, "apiKey" | "onProgress" | "signal">
  ) => Promise<ImportResult | null>;
  /** Whether an import is currently in progress */
  isImporting: boolean;
  /** Current progress information */
  progress: ImportProgress | null;
  /** Error message if import failed */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
  /** Whether import is possible (has project) */
  canImport: boolean;
  /** Cancel the current import operation */
  cancel: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for importing story files into the current project.
 * 
 * Connects the import service to the Zustand store and provides
 * loading/progress/error state management with cancellation support.
 */
export function useStoryImporter(): UseStoryImporterResult {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get state and actions from store
  const project = useMythosStore((state) => state.project.currentProject);
  const documents = useMythosStore((state) => state.document.documents);
  const entities = useMythosStore((state) => Array.from(state.world.entities.values()));
  
  // Store actions
  const addDocument = useMythosStore((state) => state.addDocument);
  const setDocuments = useMythosStore((state) => state.setDocuments);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);
  const addEntity = useMythosStore((state) => state.addEntity);
  const updateEntity = useMythosStore((state) => state.updateEntity);

  // Get API key for entity detection
  const { key: apiKey } = useApiKey();

  const canImport = project !== null;

  const doImport = useCallback(
    async (
      file: File,
      options: Omit<ImportOptions, "apiKey" | "onProgress" | "signal">
    ): Promise<ImportResult | null> => {
      if (!project) {
        setError("No project selected");
        return null;
      }

      // Create new AbortController
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      setIsImporting(true);
      setProgress(null);
      setError(null);

      try {
        const result = await importStory({
          projectId: project.id,
          file,
          options: {
            ...options,
            apiKey: options.detectEntities ? apiKey ?? undefined : undefined,
            onProgress: setProgress,
            signal,
          },
          existingEntities: entities,
          existingDocuments: documents,
        });

        // Apply result to store
        if (options.mode === "replace") {
          // Replace all documents
          setDocuments(result.documents);
        } else {
          // Append documents
          for (const doc of result.documents) {
            addDocument(doc);
          }
        }

        // Set current document to the first imported chapter
        const firstChapter = result.documents.find((d) => d.type === "chapter");
        if (firstChapter) {
          setCurrentDocument(firstChapter);
        } else if (result.documents.length > 0) {
          setCurrentDocument(result.documents[0]);
        }

        // Apply entity upserts
        if (result.entityUpserts) {
          for (const entity of result.entityUpserts.created) {
            addEntity(entity);
          }
          for (const entity of result.entityUpserts.updated) {
            updateEntity(entity.id, entity);
          }
        }

        return result;
      } catch (err) {
        // Handle cancellation
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("Import cancelled");
          return null;
        }

        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during import";
        setError(message);
        console.error("Import failed:", err);
        return null;
      } finally {
        setIsImporting(false);
        setProgress(null);
        abortControllerRef.current = null;
      }
    },
    [
      project,
      documents,
      entities,
      apiKey,
      addDocument,
      setDocuments,
      setCurrentDocument,
      addEntity,
      updateEntity,
    ]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    importStory: doImport,
    isImporting,
    progress,
    error,
    clearError,
    canImport,
    cancel,
  };
}
