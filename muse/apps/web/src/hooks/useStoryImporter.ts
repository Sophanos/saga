import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useMythosStore } from "../stores";
import {
  importStory,
  type ImportOptions,
  type ImportResult,
  type ImportProgress,
} from "../services/import";
import { blocksToText } from "../services/export/ir";
import { tiptapDocToBlocks } from "../services/export/tiptap/tiptapToIr";
import { useApiKey } from "./useApiKey";
import { useEntityPersistence } from "./useEntityPersistence";
import { toast } from "@mythos/ui";

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

  // Convex mutations
  const createDocumentMutation = useMutation(api.documents.create);
  const removeDocumentMutation = useMutation(api.documents.remove);

  // Entity persistence
  const { createEntity, updateEntity } = useEntityPersistence();

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

        if (signal?.aborted) {
          throw new DOMException("Import cancelled", "AbortError");
        }

        const pendingDocuments = [...result.documents];
        const createdDocuments: typeof result.documents = [];
        const idMap = new Map<string, string>();
        let deferrals = 0;

        while (pendingDocuments.length > 0) {
          const doc = pendingDocuments.shift();
          if (!doc) break;

          const parentId = doc.parentId ? idMap.get(doc.parentId) : undefined;
          if (doc.parentId && !parentId) {
            pendingDocuments.push(doc);
            deferrals += 1;
            if (deferrals > pendingDocuments.length + 2) {
              throw new Error("Failed to resolve imported document hierarchy");
            }
            continue;
          }

          deferrals = 0;
          const contentText = blocksToText(tiptapDocToBlocks(doc.content));
          const createdId = await createDocumentMutation({
            projectId: project.id as Id<"projects">,
            parentId: parentId as Id<"documents"> | undefined,
            type: doc.type,
            title: doc.title,
            content: doc.content as Record<string, unknown>,
            contentText,
            orderIndex: doc.orderIndex,
          });

          const createdDoc = {
            ...doc,
            id: createdId,
            projectId: project.id,
            parentId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          idMap.set(doc.id, createdId);
          createdDocuments.push(createdDoc);

          if (signal?.aborted) {
            throw new DOMException("Import cancelled", "AbortError");
          }
        }

        if (options.mode === "replace" && documents.length > 0) {
          const rootDocuments = documents.filter((doc) => !doc.parentId);
          for (const doc of rootDocuments) {
            await removeDocumentMutation({
              id: doc.id as Id<"documents">,
            });
          }
        }

        // Apply result to store
        if (options.mode === "replace") {
          // Replace all documents
          setDocuments(createdDocuments);
        } else {
          // Append documents
          for (const doc of createdDocuments) {
            addDocument(doc);
          }
        }

        // Set current document to the first imported chapter
        const firstChapter = createdDocuments.find((d) => d.type === "chapter");
        if (firstChapter) {
          setCurrentDocument(firstChapter);
        } else if (createdDocuments.length > 0) {
          setCurrentDocument(createdDocuments[0]);
        }

        // Apply entity upserts
        if (result.entityUpserts) {
          for (const entity of result.entityUpserts.created) {
            const persisted = await createEntity(entity, project.id);
            if (persisted.error) {
              console.warn("[useStoryImporter] Entity create failed:", persisted.error);
            }
          }
          for (const entity of result.entityUpserts.updated) {
            const persisted = await updateEntity(entity.id, {
              name: entity.name,
              aliases: entity.aliases,
              properties: entity.properties,
              notes: entity.notes,
            });
            if (persisted.error) {
              console.warn("[useStoryImporter] Entity update failed:", persisted.error);
            }
          }
        }

        toast.success(`Imported ${createdDocuments.length} document${createdDocuments.length === 1 ? "" : "s"}`, {
          description: result.entityUpserts
            ? `${result.entityUpserts.created.length + result.entityUpserts.updated.length} entities detected`
            : undefined,
        });

        return { ...result, documents: createdDocuments };
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
      createDocumentMutation,
      removeDocumentMutation,
      createEntity,
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
