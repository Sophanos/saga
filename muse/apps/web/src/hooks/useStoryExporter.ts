import { useState, useCallback } from "react";
import { useMythosStore } from "../stores";
import { exportStory, type ExportOptions, type ExportStoryParams } from "../services/export";
import type { Editor } from "@mythos/editor";
import { toast } from "@mythos/ui";

// ============================================================================
// Types
// ============================================================================

export interface UseStoryExporterResult {
  /** Export the story with the given options */
  exportStory: (options: ExportOptions) => Promise<void>;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Error message if export failed */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
  /** Whether export is possible (has project and documents) */
  canExport: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for exporting the current project's story
 * 
 * Connects the export service to the Zustand store and provides
 * loading/error state management.
 */
export function useStoryExporter(): UseStoryExporterResult {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get state from store
  const project = useMythosStore((state) => state.project.currentProject);
  const documents = useMythosStore((state) => state.document.documents);
  const currentDocument = useMythosStore((state) => state.document.currentDocument);
  const entities = useMythosStore((state) => Array.from(state.world.entities.values()));
  const editorInstance = useMythosStore((state) => state.editor.editorInstance);

  const canExport = project !== null && documents.length > 0;

  const doExport = useCallback(
    async (options: ExportOptions) => {
      if (!project) {
        setError("No project selected");
        return;
      }

      if (documents.length === 0) {
        setError("No documents to export");
        return;
      }

      setIsExporting(true);
      setError(null);

      try {
        // Get current editor content if available (for unsaved changes)
        let currentEditorContent: unknown | undefined;
        let currentDocumentId: string | undefined;

        if (editorInstance && currentDocument) {
          const editor = editorInstance as Editor;
          if (typeof editor.getJSON === "function") {
            currentEditorContent = editor.getJSON();
            currentDocumentId = currentDocument.id;
          }
        }

        await exportStory({
          project: project as ExportStoryParams["project"],
          documents,
          entities,
          options,
          currentDocumentId,
          currentEditorContent,
        });

        // Show success toast with format
        const formatLabel = options.format.toUpperCase();
        toast.success(`Exported as ${formatLabel}`, {
          description: `${documents.length} document${documents.length === 1 ? "" : "s"} exported`,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during export";
        setError(message);
        console.error("Export failed:", err);
      } finally {
        setIsExporting(false);
      }
    },
    [project, documents, entities, currentDocument, editorInstance]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    exportStory: doExport,
    isExporting,
    error,
    clearError,
    canExport,
  };
}
