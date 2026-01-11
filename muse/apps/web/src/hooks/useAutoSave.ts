import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@mythos/editor";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useMythosStore } from "../stores";
import { simpleHash } from "../utils/hash";

/**
 * Default debounce delay in milliseconds before auto-saving
 */
const DEFAULT_DEBOUNCE_MS = 2000;


/**
 * Options for the useAutoSave hook
 */
export interface UseAutoSaveOptions {
  /** Tiptap editor instance */
  editor: Editor | null;
  /** Document ID to save to (null disables saving) */
  documentId: string | null;
  /** Whether auto-save is enabled */
  enabled?: boolean;
  /** Custom debounce delay in milliseconds */
  debounceMs?: number;
}

/**
 * Return type for the useAutoSave hook
 */
export interface UseAutoSaveResult {
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** Timestamp of the last successful save */
  lastSavedAt: Date | null;
  /** Error message if save failed */
  error: string | null;
  /** Manually trigger a save immediately */
  saveNow: () => Promise<void>;
  /** Whether there are unsaved changes */
  isDirty: boolean;
}

/**
 * Hook for automatic document persistence with debouncing
 *
 * Features:
 * - Watches editor content changes via onUpdate
 * - Debounces saves (default 2 seconds after typing stops)
 * - Tracks dirty state and last saved timestamp
 * - Saves both JSON and plain text content
 * - Updates word count on save
 * - Handles errors gracefully
 * - Cleanup on unmount (attempts final save)
 *
 * @param options - Hook configuration options
 * @returns Auto-save state and controls
 *
 * @example
 * ```tsx
 * const { isSaving, lastSavedAt, error, saveNow } = useAutoSave({
 *   editor,
 *   documentId: currentDocument?.id ?? null,
 *   enabled: true,
 *   debounceMs: 2000,
 * });
 * ```
 */
export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveResult {
  const {
    editor,
    documentId,
    enabled = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;

  // Convex mutation for updating documents
  const updateDocumentMutation = useMutation(api.documents.update);

  // Local state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store state and actions
  const isDirty = useMythosStore((state) => state.editor.isDirty);
  const setDirty = useMythosStore((state) => state.setDirty);

  // Refs for tracking and debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const isMountedRef = useRef(true);
  const pendingSaveRef = useRef(false);
  const updateDocumentRef = useRef(updateDocumentMutation);

  // Keep mutation ref updated
  updateDocumentRef.current = updateDocumentMutation;


  /**
   * Get content hash from editor JSON structure
   * Uses JSON.stringify to capture marks, metadata, and structural changes
   * that wouldn't be reflected in plain text alone.
   */
  const getContentHash = useCallback((): string => {
    if (!editor || editor.isDestroyed) {
      return "";
    }
    // Hash the full JSON structure to detect all changes including:
    // - Text content changes
    // - Mark changes (bold, italic, entity tags, etc.)
    // - Node attribute changes (metadata)
    // - Structural changes (node types, nesting)
    const json = editor.getJSON();
    return simpleHash(JSON.stringify(json));
  }, [editor]);

  /**
   * Core save function
   */
  const performSave = useCallback(async () => {
    // Guard checks
    if (!editor || editor.isDestroyed) {
      return;
    }

    if (!documentId) {
      return;
    }

    // Check if content has actually changed
    const currentHash = getContentHash();
    if (currentHash === lastSavedHashRef.current) {
      // Content unchanged, mark as clean
      setDirty(false);
      return;
    }

    // Prevent concurrent saves
    if (isSaving) {
      pendingSaveRef.current = true;
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Get content in both formats
      const jsonContent = editor.getJSON();
      const textContent = editor.getText();

      // Call the Convex updateDocument mutation
      await updateDocumentMutation({
        id: documentId as Id<"documents">,
        content: jsonContent as Record<string, unknown>,
        contentText: textContent,
      });

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        lastSavedHashRef.current = currentHash;
        setLastSavedAt(new Date());
        setDirty(false);
        setError(null);
      }
    } catch (err) {
      // Only update error state if component is still mounted
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : "Failed to save document";
        setError(message);
        console.error("[useAutoSave] Error:", err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);

        // If there was a pending save request during save, trigger another save
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          // Use setTimeout to avoid potential stack overflow
          setTimeout(() => performSave(), 0);
        }
      }
    }
  }, [editor, documentId, isSaving, getContentHash, setDirty, updateDocumentMutation]);

  /**
   * Public save function - saves immediately
   */
  const saveNow = useCallback(async () => {
    // Clear any pending debounced save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    await performSave();
  }, [performSave]);

  /**
   * Handle editor content updates
   */
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }

    if (!enabled) {
      return;
    }

    if (!documentId) {
      return;
    }

    // Subscribe to editor updates
    const handleUpdate = () => {
      // Mark as dirty immediately
      setDirty(true);

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        performSave();
      }, debounceMs);
    };

    // Attach the update handler
    editor.on("update", handleUpdate);

    // Cleanup
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, enabled, documentId, debounceMs, setDirty, performSave]);

  /**
   * Handle document ID changes - reset state
   */
  useEffect(() => {
    // When documentId changes, reset the saved hash to trigger initial comparison
    lastSavedHashRef.current = "";
    setLastSavedAt(null);
    setError(null);
  }, [documentId]);

  /**
   * Cleanup on unmount - attempt final save if dirty
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Attempt final save if there are unsaved changes
      // Note: This is a best-effort save on unmount
      if (isDirty && editor && !editor.isDestroyed && documentId) {
        // Use synchronous approach for unmount save attempt
        const jsonContent = editor.getJSON();
        const textContent = editor.getText();

        // Fire and forget - we can't await in cleanup
        updateDocumentRef.current({
          id: documentId as Id<"documents">,
          content: jsonContent as Record<string, unknown>,
          contentText: textContent,
        }).catch((err: unknown) => {
          console.error("[useAutoSave] Failed to save on unmount:", err);
        });
      }
    };
  }, [isDirty, editor, documentId]);

  /**
   * Handle page visibility changes - save when user leaves tab
   */
  useEffect(() => {
    if (!enabled || !documentId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isDirty) {
        saveNow();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // Attempt to save
        saveNow();
        if (!E2E_MODE) {
          // Show browser's native "unsaved changes" dialog
          e.preventDefault();
          e.returnValue = "";
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, documentId, isDirty, saveNow]);

  return {
    isSaving,
    lastSavedAt,
    error,
    saveNow,
    isDirty,
  };
}

/**
 * Hook for accessing auto-save status from other components
 * Useful for status indicators that don't need the full hook
 */
export function useAutoSaveStatus() {
  const isDirty = useMythosStore((state) => state.editor.isDirty);

  return {
    isDirty,
  };
}
