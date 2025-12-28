import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsistencyIssue } from "@mythos/ai";
import { replaceText, jumpToPosition, type Editor } from "@mythos/editor";
import { useMythosStore, type LinterIssue } from "../stores";
import { useUndoStore } from "../stores/undo";
import { useApiKey } from "./useApiKey";
import { lintDocumentViaEdge, LinterApiError } from "../services/ai";
import { simpleHash } from "../utils/hash";

// Re-export LinterIssue for convenience
export type { LinterIssue };

/**
 * Options for the useLinterFixes hook
 */
export interface UseLinterOptions {
  /** Content to lint */
  content: string;
  /** Tiptap editor instance for applying fixes */
  editor: Editor | null;
  /** Whether auto-linting is enabled */
  autoLint?: boolean;
  /** Custom debounce delay in milliseconds */
  debounceMs?: number;
  /** Whether the hook is enabled (false disables all linting) */
  enabled?: boolean;
}

/**
 * Return type for the useLinterFixes hook
 */
export interface UseLinterResult {
  /** List of linter issues with IDs */
  issues: LinterIssue[];
  /** Whether linting is currently running */
  isLinting: boolean;
  /** Error message if linting failed */
  error: string | null;
  /** Manually trigger linting */
  runLint: () => Promise<void>;
  /** Apply a single fix to the editor */
  applyFix: (issueId: string) => void;
  /** Apply all available fixes */
  applyAllFixes: () => void;
  /** Jump to an issue location in the editor */
  jumpToIssue: (issueId: string) => void;
  /** Clear all issues */
  clearIssues: () => void;
  /** Undo the last applied fix */
  undoLastFix: () => boolean;
  /** Redo the last undone fix */
  redoLastFix: () => boolean;
  /** Whether there are undoable fixes */
  canUndo: boolean;
  /** Whether there are redoable fixes */
  canRedo: boolean;
  /** Number of undoable fixes */
  undoCount: number;
}

/**
 * Generate a unique ID for an issue based on its properties
 */
function generateIssueId(issue: ConsistencyIssue, index: number): string {
  return `${issue.type}-${issue.location.line}-${index}-${simpleHash(issue.message)}`;
}

/**
 * Convert ConsistencyIssue[] to LinterIssue[] with IDs
 */
function addIdsToIssues(issues: ConsistencyIssue[]): LinterIssue[] {
  return issues.map((issue, index) => ({
    ...issue,
    id: generateIssueId(issue, index),
  }));
}

/**
 * Find the position in the document for a given line number
 * Searches the content for the line and returns the character position
 */
function findPositionForLine(content: string, lineNumber: number, targetText: string): number {
  const lines = content.split("\n");
  let position = 0;

  // Calculate position at start of target line
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    position += lines[i].length + 1; // +1 for newline
  }

  // Try to find the target text within the line for more precise positioning
  if (lineNumber <= lines.length) {
    const line = lines[lineNumber - 1];
    const textIndex = line.indexOf(targetText);
    if (textIndex !== -1) {
      position += textIndex;
    }
  }

  return position;
}

/**
 * Default debounce delay in milliseconds
 */
const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Minimum content length to trigger linting
 */
const MIN_CONTENT_LENGTH = 50;

/**
 * Hook for managing consistency linting with fix application
 *
 * Features:
 * - Debounced auto-linting after typing stops
 * - Manual linting trigger
 * - Apply individual or all fixes
 * - Jump to issue location in editor
 * - Tracks applied fixes
 * - Integration with global linter store
 * - Error handling
 *
 * @param options - Hook configuration options
 * @returns Linting state and controls
 */
export function useLinterFixes(options: UseLinterOptions): UseLinterResult {
  const {
    content,
    editor,
    autoLint = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    enabled = true,
  } = options;

  // API key for BYOK pattern
  const { key: apiKey } = useApiKey();

  // Store actions
  const setLinterIssues = useMythosStore((state) => state.setLinterIssues);
  const setLinterRunning = useMythosStore((state) => state.setLinterRunning);
  const setLinterError = useMythosStore((state) => state.setLinterError);
  const clearLinterIssues = useMythosStore((state) => state.clearLinterIssues);
  const storeIssues = useMythosStore((state) => state.linter.issues);
  const isLinting = useMythosStore((state) => state.linter.isRunning);

  // Project and document info for API calls
  const currentProject = useMythosStore((state) => state.project.currentProject);
  const currentDocument = useMythosStore((state) => state.document.currentDocument);

  // Undo store
  const pushUndo = useUndoStore((state) => state.pushUndo);
  const undoFromStore = useUndoStore((state) => state.undo);
  const redoFromStore = useUndoStore((state) => state.redo);
  const canUndo = useUndoStore((state) => state.undoStack.length > 0);
  const canRedo = useUndoStore((state) => state.redoStack.length > 0);
  const undoCount = useUndoStore((state) => state.undoStack.length);

  // Local state
  const [issues, setIssues] = useState<LinterIssue[]>([]);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Refs for debouncing and tracking
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<string>("");
  const lastContentHashRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Sync store issues to local state (issues now already have IDs)
   */
  useEffect(() => {
    setIssues(storeIssues);
  }, [storeIssues]);

  /**
   * Run the consistency linter via edge function
   */
  const runLint = useCallback(async () => {
    // Don't lint if disabled or content is too short
    if (!enabled || content.length < MIN_CONTENT_LENGTH) {
      return;
    }

    // Don't lint if we don't have project/document context
    if (!currentProject?.id || !currentDocument?.id) {
      console.warn("[useLinterFixes] Missing project or document context");
      return;
    }

    // Check if content hash matches last analyzed - skip if same
    const contentHash = simpleHash(content);
    if (contentHash === lastContentHashRef.current) {
      return;
    }

    // Cancel any pending lint
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLinterRunning(true);
    setError(null);

    try {
      // Get genre from project config, default to "literary" if not set
      const genre = currentProject.config?.genre ?? "literary";

      // Call the edge function
      const result = await lintDocumentViaEdge(
        {
          projectId: currentProject.id,
          documentId: currentDocument.id,
          content,
          genre,
        },
        {
          apiKey: apiKey || undefined,
          signal: abortControllerRef.current.signal,
        }
      );

      // Check if we were aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Convert issues to LinterIssue with IDs before storing
      const linterIssues = addIdsToIssues(result.issues);

      // Update store with results
      setLinterIssues(linterIssues);

      // Update tracking refs
      lastContentRef.current = content;
      lastContentHashRef.current = contentHash;

      // Reset applied fixes since content changed
      setAppliedFixes(new Set());
    } catch (err) {
      // Handle LinterApiError with specific error codes
      if (err instanceof LinterApiError) {
        // Ignore abort errors
        if (err.code === "ABORTED") {
          return;
        }

        // Handle specific error codes
        let errorMessage = err.message;
        switch (err.code) {
          case "UNAUTHORIZED":
            errorMessage = "API key required. Please add your OpenRouter API key in settings.";
            break;
          case "RATE_LIMITED":
            errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
            break;
          case "CONFIGURATION_ERROR":
            errorMessage = "Configuration error. Please check your environment settings.";
            break;
          case "VALIDATION_ERROR":
            errorMessage = `Validation error: ${err.message}`;
            break;
          case "SERVER_ERROR":
            errorMessage = "Server error. Please try again later.";
            break;
        }

        setError(errorMessage);
        setLinterError(errorMessage);
        console.error("[useLinterFixes] LinterApiError:", err.code, err.message);
        return;
      }

      // Handle generic abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : "Linting failed";
      setError(message);
      setLinterError(message);
      console.error("[useLinterFixes] Error:", err);
    } finally {
      setLinterRunning(false);
    }
  }, [
    content,
    currentProject,
    currentDocument,
    apiKey,
    setLinterIssues,
    setLinterRunning,
    setLinterError,
  ]);

  /**
   * Apply a single fix to the editor
   */
  const applyFix = useCallback(
    (issueId: string) => {
      if (!editor) {
        console.warn("[useLinterFixes] No editor available to apply fix");
        return;
      }

      const issue = issues.find((i) => i.id === issueId);
      if (!issue) {
        console.warn(`[useLinterFixes] Issue not found: ${issueId}`);
        return;
      }

      if (appliedFixes.has(issueId)) {
        console.warn(`[useLinterFixes] Fix already applied: ${issueId}`);
        return;
      }

      try {
        // Find the position of the issue in the document
        const editorContent = editor.getText();
        const position = findPositionForLine(
          editorContent,
          issue.location.line,
          issue.location.text
        );

        // Calculate the end position based on the original text length
        const from = position;
        const to = position + issue.location.text.length;

        // Push to undo stack before applying fix
        pushUndo({
          type: "fix",
          issueId,
          before: issue.location.text,
          after: issue.suggestion,
          position: { from, to },
          issueType: issue.type,
          issueSeverity: issue.severity,
          description: `Fixed ${issue.type} issue: "${issue.location.text}" -> "${issue.suggestion}"`,
        });

        // Apply the fix by replacing the text with the suggestion
        replaceText(editor, from, to, issue.suggestion);

        // Mark as applied
        setAppliedFixes((prev) => new Set([...prev, issueId]));

        // Remove from issues list
        setIssues((prev) => prev.filter((i) => i.id !== issueId));

        // Update store
        const remainingIssues = storeIssues.filter(
          (_, index) => generateIssueId(storeIssues[index], index) !== issueId
        );
        setLinterIssues(remainingIssues);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to apply fix";
        setError(message);
        console.error("[useLinterFixes] Error applying fix:", err);
      }
    },
    [editor, issues, appliedFixes, storeIssues, setLinterIssues, pushUndo]
  );

  /**
   * Apply all available fixes
   */
  const applyAllFixes = useCallback(() => {
    if (!editor) {
      console.warn("[useLinterFixes] No editor available to apply fixes");
      return;
    }

    if (issues.length === 0) {
      return;
    }

    // Sort issues by position in reverse order to avoid position shifting
    const sortedIssues = [...issues].sort((a, b) => b.location.line - a.location.line);

    const appliedIds: string[] = [];
    const editorContent = editor.getText();

    try {
      for (const issue of sortedIssues) {
        if (appliedFixes.has(issue.id)) {
          continue;
        }

        // Find the position of the issue in the document
        const position = findPositionForLine(
          editorContent,
          issue.location.line,
          issue.location.text
        );

        // Calculate the end position based on the original text length
        const from = position;
        const to = position + issue.location.text.length;

        // Apply the fix by replacing the text with the suggestion
        replaceText(editor, from, to, issue.suggestion);

        appliedIds.push(issue.id);
      }

      // Mark all as applied
      setAppliedFixes((prev) => new Set([...prev, ...appliedIds]));

      // Clear all issues
      setIssues([]);
      clearLinterIssues();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply all fixes";
      setError(message);
      console.error("[useLinterFixes] Error applying all fixes:", err);
    }
  }, [editor, issues, appliedFixes, clearLinterIssues]);

  /**
   * Jump to an issue location in the editor
   */
  const jumpToIssue = useCallback(
    (issueId: string) => {
      if (!editor) {
        console.warn("[useLinterFixes] No editor available to jump to issue");
        return;
      }

      const issue = issues.find((i) => i.id === issueId);
      if (!issue) {
        console.warn(`[useLinterFixes] Issue not found: ${issueId}`);
        return;
      }

      try {
        // Find the position of the issue in the document
        const editorContent = editor.getText();
        const position = findPositionForLine(
          editorContent,
          issue.location.line,
          issue.location.text
        );

        // Jump to the position
        jumpToPosition(editor, position);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to jump to issue";
        setError(message);
        console.error("[useLinterFixes] Error jumping to issue:", err);
      }
    },
    [editor, issues]
  );

  /**
   * Clear all issues
   */
  const clearIssues = useCallback(() => {
    setIssues([]);
    setAppliedFixes(new Set());
    setError(null);
    clearLinterIssues();
  }, [clearLinterIssues]);

  /**
   * Undo the last applied fix
   * Returns true if an undo was performed, false otherwise
   */
  const undoLastFix = useCallback((): boolean => {
    if (!editor) {
      console.warn("[useLinterFixes] No editor available to undo fix");
      return false;
    }

    const entry = undoFromStore();
    if (!entry) {
      console.warn("[useLinterFixes] No fix to undo");
      return false;
    }

    try {
      // Get current editor content
      const editorContent = editor.getText();

      // Find where the "after" text currently is in the document
      // The position might have shifted due to other edits, so we search for the text
      const afterTextIndex = editorContent.indexOf(entry.after, Math.max(0, entry.position.from - 50));

      if (afterTextIndex === -1) {
        console.warn("[useLinterFixes] Could not find text to undo - document may have changed");
        setError("Could not find text to undo - document may have changed");
        return false;
      }

      // Replace the "after" text with the original "before" text
      const from = afterTextIndex;
      const to = afterTextIndex + entry.after.length;
      replaceText(editor, from, to, entry.before);

      // Remove from applied fixes so it can be reapplied
      setAppliedFixes((prev) => {
        const next = new Set(prev);
        next.delete(entry.issueId);
        return next;
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to undo fix";
      setError(message);
      console.error("[useLinterFixes] Error undoing fix:", err);
      return false;
    }
  }, [editor, undoFromStore]);

  /**
   * Redo the last undone fix
   * Returns true if a redo was performed, false otherwise
   */
  const redoLastFix = useCallback((): boolean => {
    if (!editor) {
      console.warn("[useLinterFixes] No editor available to redo fix");
      return false;
    }

    const entry = redoFromStore();
    if (!entry) {
      console.warn("[useLinterFixes] No fix to redo");
      return false;
    }

    try {
      // Get current editor content
      const editorContent = editor.getText();

      // Find where the "before" text currently is in the document
      const beforeTextIndex = editorContent.indexOf(entry.before, Math.max(0, entry.position.from - 50));

      if (beforeTextIndex === -1) {
        console.warn("[useLinterFixes] Could not find text to redo - document may have changed");
        setError("Could not find text to redo - document may have changed");
        return false;
      }

      // Replace the "before" text with the "after" text
      const from = beforeTextIndex;
      const to = beforeTextIndex + entry.before.length;
      replaceText(editor, from, to, entry.after);

      // Mark as applied again
      setAppliedFixes((prev) => new Set([...prev, entry.issueId]));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to redo fix";
      setError(message);
      console.error("[useLinterFixes] Error redoing fix:", err);
      return false;
    }
  }, [editor, redoFromStore]);

  /**
   * Debounced auto-lint effect
   */
  useEffect(() => {
    // Skip if disabled or auto-lint is disabled
    if (!enabled || !autoLint) {
      return;
    }

    // Skip if content hasn't changed
    if (content === lastContentRef.current) {
      return;
    }

    // Skip if content is too short
    if (content.length < MIN_CONTENT_LENGTH) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      runLint();
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, autoLint, debounceMs, runLint]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Filter out applied fixes from the returned issues
  const activeIssues = issues.filter((issue) => !appliedFixes.has(issue.id));

  return {
    issues: activeIssues,
    isLinting,
    error,
    runLint,
    applyFix,
    applyAllFixes,
    jumpToIssue,
    clearIssues,
    undoLastFix,
    redoLastFix,
    canUndo,
    canRedo,
    undoCount,
  };
}

/**
 * Hook for accessing linter data without content binding
 * Useful for components that just need to read linter state
 */
export function useLinterData() {
  const issues = useMythosStore((state) => state.linter.issues);
  const isRunning = useMythosStore((state) => state.linter.isRunning);
  const lastRunAt = useMythosStore((state) => state.linter.lastRunAt);
  const error = useMythosStore((state) => state.linter.error);

  return {
    issues, // Issues already have IDs from the API/store
    isRunning,
    lastRunAt,
    error,
  };
}

/**
 * Hook for getting issue counts by type
 */
export function useLinterIssuesByType() {
  const issues = useMythosStore((state) => state.linter.issues);

  const counts = {
    character: 0,
    world: 0,
    plot: 0,
    timeline: 0,
  };

  issues.forEach((issue) => {
    counts[issue.type]++;
  });

  return counts;
}

/**
 * Hook for getting issue counts by severity
 */
export function useLinterIssuesBySeverity() {
  const issues = useMythosStore((state) => state.linter.issues);

  const counts = {
    info: 0,
    warning: 0,
    error: 0,
  };

  issues.forEach((issue) => {
    counts[issue.severity]++;
  });

  return counts;
}
