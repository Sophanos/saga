/**
 * useProgressiveLinter
 * 
 * Orchestrates linter runs for progressive disclosure.
 * Runs periodically in gardener mode during Phase 2 to detect contradictions
 * and trigger the Phase 2 → 3 transition.
 */

import { useEffect, useRef, useCallback } from "react";
import { useMythosStore } from "../stores";
import {
  useProgressiveStore,
  useIsGardenerMode,
  useActivePhase,
  useActiveProjectId,
  type ConsistencyChoiceNudge,
} from "@mythos/state";
import { lintDocumentViaEdge, type LintIssue } from "../services/ai";

// ============================================================================
// Constants
// ============================================================================

/** Debounce time after last edit before running linter (ms) */
const LINTER_DEBOUNCE_MS = 10000;

/** Minimum word count before running progressive linter */
const MIN_WORD_COUNT_FOR_LINT = 300;

/** Cooldown between lint runs (ms) - prevents excessive API calls */
const LINT_COOLDOWN_MS = 60000;

// ============================================================================
// Types
// ============================================================================

export interface UseProgressiveLinterOptions {
  /** Enable/disable the hook */
  enabled?: boolean;
  /** Custom debounce time (ms) */
  debounceMs?: number;
}

export interface UseProgressiveLinterResult {
  /** Manually trigger a lint run */
  runLint: () => Promise<void>;
  /** Whether a lint is currently running */
  isLinting: boolean;
  /** Last lint timestamp */
  lastLintAt: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an issue is a contradiction
 */
function isContradiction(issue: LintIssue): boolean {
  return (
    issue.isContradiction === true ||
    (issue.severity === "error" && 
     issue.relatedLocations !== undefined && 
     issue.relatedLocations.length > 0)
  );
}

/**
 * Get word count from text
 */
function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// Hook
// ============================================================================

export function useProgressiveLinter(
  options: UseProgressiveLinterOptions = {}
): UseProgressiveLinterResult {
  const { enabled = true, debounceMs = LINTER_DEBOUNCE_MS } = options;

  const projectId = useActiveProjectId();
  const isGardener = useIsGardenerMode();
  const phase = useActivePhase();

  // Get documents from store
  const documents = useMythosStore((s) =>
    Array.from(s.document.documents.values())
  );

  // Refs for timing and state
  const lastLintRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLintingRef = useRef<boolean>(false);

  // Store actions
  const { setPhase, showNudge, unlockModule } = useProgressiveStore.getState();

  /**
   * Run the progressive linter
   */
  const runLint = useCallback(async () => {
    // Guard conditions
    if (!projectId || !isGardener || phase !== 2) return;
    if (isLintingRef.current) return;
    
    // Cooldown check
    const now = Date.now();
    if (now - lastLintRef.current < LINT_COOLDOWN_MS) return;

    // Concatenate all document text for cross-doc analysis
    const sortedDocs = [...documents].sort(
      (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    );
    
    const combinedText = sortedDocs
      .map((doc, i) => {
        // Extract text from Tiptap JSON content
        const text = typeof doc.content === "string"
          ? doc.content
          : JSON.stringify(doc.content || "");
        return `--- ${doc.title || `Document ${i + 1}`} ---\n${text}`;
      })
      .join("\n\n");

    // Check minimum word count
    if (getWordCount(combinedText) < MIN_WORD_COUNT_FOR_LINT) return;

    try {
      isLintingRef.current = true;
      lastLintRef.current = now;

      // Get current project info for linter
      const currentProject = useMythosStore.getState().project.currentProject;
      const currentDocument = useMythosStore.getState().document.currentDocument;

      if (!currentProject || !currentDocument) return;

      // Run the linter
      const result = await lintDocumentViaEdge({
        projectId: currentProject.id,
        documentId: currentDocument.id,
        content: combinedText,
        genre: "general", // TODO: Extract genre from project config when available
      });

      // Check for contradictions
      const contradictions = result.issues.filter(isContradiction);

      if (contradictions.length > 0) {
        // Transition to Phase 3
        setPhase(projectId, 3);
        
        // Unlock console so user can see the issue
        unlockModule(projectId, "console");

        // Show nudge for first contradiction
        const first = contradictions[0];
        const nudge: ConsistencyChoiceNudge = {
          id: `${projectId}:consistency:${first.id || Date.now()}`,
          projectId,
          type: "consistency_choice",
          createdAt: new Date().toISOString(),
          issueId: first.id || `issue-${Date.now()}`,
          summary: first.message,
        };
        showNudge(nudge);

        console.log(
          `[useProgressiveLinter] Detected ${contradictions.length} contradiction(s), transitioning to Phase 3`
        );
      }
    } catch (error) {
      console.error("[useProgressiveLinter] Lint failed:", error);
    } finally {
      isLintingRef.current = false;
    }
  }, [
    projectId,
    isGardener,
    phase,
    documents,
    setPhase,
    showNudge,
    unlockModule,
  ]);

  /**
   * Debounced linting triggered by document changes
   */
  useEffect(() => {
    // Only run for gardener mode in Phase 2
    if (!enabled || !isGardener || phase !== 2) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up debounced lint
    timeoutRef.current = setTimeout(() => {
      runLint();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, isGardener, phase, documents, debounceMs, runLint]);

  return {
    runLint,
    isLinting: isLintingRef.current,
    lastLintAt: lastLintRef.current || null,
  };
}

export default useProgressiveLinter;
