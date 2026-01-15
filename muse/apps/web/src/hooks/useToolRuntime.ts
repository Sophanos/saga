/**
 * useToolRuntime Hook
 *
 * Central runtime for executing AI agent tools.
 * Manages tool lifecycle, status updates, and execution.
 *
 * This hook decouples tool execution from UI components,
 * allowing tools to be executed from any surface (chat, command palette, etc.)
 */

import { useCallback, useEffect, useRef } from "react";
import { useMythosStore, type ChatToolInvocation, type LinterIssue } from "../stores";
import { useAnalysisStore } from "../stores/analysis";
import type { StyleIssue, ReadabilityMetrics } from "@mythos/core";
import { useEntityPersistence } from "./useEntityPersistence";
import { useRelationshipPersistence } from "./useRelationshipPersistence";
import { useApiKey } from "./useApiKey";
import { getTool, type ToolExecutionContext, type ToolExecutionResult } from "../tools";
import type { Editor } from "@mythos/editor";
import { useConvex } from "convex/react";

/**
 * Result of a tool runtime operation.
 */
export interface ToolRuntimeResult {
  success: boolean;
  error?: string;
}

/**
 * Return type for the useToolRuntime hook.
 */
export interface UseToolRuntimeResult {
  /** Accept a proposed tool and execute it */
  acceptTool: (messageId: string) => Promise<ToolRuntimeResult>;
  /** Reject a proposed tool */
  rejectTool: (messageId: string) => void;
  /** Cancel an executing tool (actually aborts the execution) */
  cancelTool: (messageId: string) => void;
  /** Retry a failed tool */
  retryTool: (messageId: string) => Promise<ToolRuntimeResult>;
  /** Build execution context (for advanced use cases) */
  buildContext: (signal?: AbortSignal) => ToolExecutionContext | null;
}

/**
 * Hook for executing AI agent tools.
 *
 * Centralizes all tool execution logic, managing:
 * - Status transitions (proposed → accepted → executing → executed/failed)
 * - Persistence operations (entities, relationships)
 * - Error handling and retries
 * - Progress updates for long-running operations
 */
export function useToolRuntime(): UseToolRuntimeResult {
  // Store actions - subscribe to these for stable references
  const updateToolStatus = useMythosStore((s) => s.updateToolStatus);
  const updateToolInvocation = useMythosStore((s) => s.updateToolInvocation);

  // Get API key for saga tools
  const { key: apiKey } = useApiKey();

  const convex = useConvex();

  // Persistence hooks
  const {
    createEntity,
    updateEntity: persistUpdateEntity,
    deleteEntity,
  } = useEntityPersistence();

  const {
    createRelationship,
    updateRelationship: persistUpdateRelationship,
    deleteRelationship,
  } = useRelationshipPersistence();

  // Track AbortControllers for each executing tool (by messageId)
  const abortControllerRef = useRef<Map<string, AbortController>>(new Map());

  // Track which tools are currently executing (prevents double-execution race condition)
  const executingRef = useRef<Set<string>>(new Set());

  // Cleanup effect: abort all in-flight controllers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Abort all in-flight AbortControllers
      abortControllerRef.current.forEach((controller) => {
        controller.abort();
      });
      // Clear the Map
      abortControllerRef.current.clear();
      // Clear the executing Set
      executingRef.current.clear();
    };
  }, []);

  /**
   * Build execution context with all dependencies.
   * Reads fresh state from store at execution time to avoid stale closures.
   * @param signal Optional AbortSignal for cancellation support
   * @param messageId Optional message ID for progress updates
   */
  const buildContext = useCallback((signal?: AbortSignal, messageId?: string): ToolExecutionContext | null => {
    // Read fresh state at execution time to avoid stale closures
    const state = useMythosStore.getState();
    const projectId = state.project.currentProject?.id;
    const entities = state.world.entities;
    const relationships = state.world.relationships;
    const editorInstance = state.editor.editorInstance as Editor | null;

    if (!projectId) return null;

    return {
      projectId,
      convex,
      signal,
      entities,
      relationships,
      // Entity operations
      createEntity: async (entity, pid) => {
        const result = await createEntity(entity, pid);
        return { data: result.data ?? undefined, error: result.error ?? undefined };
      },
      updateEntity: async (id, updates) => {
        const result = await persistUpdateEntity(id, updates);
        return { data: result.data ?? undefined, error: result.error ?? undefined };
      },
      deleteEntity: async (id) => {
        const result = await deleteEntity(id);
        return { success: !result.error, error: result.error ?? undefined };
      },
      // Relationship operations
      createRelationship: async (rel, pid) => {
        const result = await createRelationship(rel, pid);
        return { data: result.data ?? undefined, error: result.error ?? undefined };
      },
      updateRelationship: async (id, updates) => {
        const result = await persistUpdateRelationship(id, updates);
        return { data: result.data ?? undefined, error: result.error ?? undefined };
      },
      deleteRelationship: async (id) => {
        const result = await deleteRelationship(id);
        return { success: !result.error, error: result.error ?? undefined };
      },
      // Store actions - read fresh from store to avoid stale closures
      addEntity: (entity) => useMythosStore.getState().addEntity(entity),
      addRelationship: (rel) => useMythosStore.getState().addRelationship(rel),
      removeEntity: (id) => useMythosStore.getState().removeEntity(id),
      removeRelationship: (id) => useMythosStore.getState().removeRelationship(id),

      // ==========================================================================
      // Saga Tool Extensions
      // ==========================================================================

      apiKey: apiKey ?? undefined,

      getDocumentText: () => {
        if (!editorInstance) return "";
        return editorInstance.getText();
      },

      getSelectionText: () => {
        if (!editorInstance) return undefined;
        const { from, to } = editorInstance.state.selection;
        if (from === to) return undefined;
        return editorInstance.state.doc.textBetween(from, to);
      },

      setLinterIssues: (issues: unknown[]) => {
        useMythosStore.getState().setLinterIssues(issues as LinterIssue[]);
      },

      setActiveTab: (tab) => {
        useMythosStore.getState().setActiveTab(tab);
      },

      setDetectedEntities: (_entities: unknown[]) => {
        // Store detected entities for review (could be stored in a separate slice)
        // For now, this is a placeholder for modal trigger
        console.log("[useToolRuntime] Detected entities:", _entities);
      },

      showEntitySuggestionModal: (detectedEntities: unknown[]) => {
        // TODO: Implement entity suggestion modal
        // For now, log and potentially open modal via store
        console.log("[useToolRuntime] Show entity suggestion modal:", detectedEntities);
      },

      setTemplateDraft: (draft: unknown) => {
        // TODO: Store template draft for review
        console.log("[useToolRuntime] Template draft:", draft);
      },

      setClarityIssues: (issues: StyleIssue[]) => {
        useAnalysisStore.getState().setClarityIssues(issues);
      },

      setReadabilityMetrics: (metrics: ReadabilityMetrics | null) => {
        useAnalysisStore.getState().setReadabilityMetrics(metrics);
      },

      onProgress: (progress) => {
        // Update tool progress in the store
        if (messageId) {
          updateToolInvocation(messageId, { progress });
        }
      },
    };
  }, [
    // Only persistence hooks and apiKey needed - state is read fresh at execution time
    apiKey,
    createEntity,
    persistUpdateEntity,
    deleteEntity,
    createRelationship,
    persistUpdateRelationship,
    deleteRelationship,
    updateToolInvocation,
    convex,
  ]);

  /**
   * Find tool invocation from a message.
   * Note: O(n) lookup via Array.find(). Consider using a Map<messageId, message>
   * in the store if message counts grow large and this becomes a bottleneck.
   */
  const findToolInvocation = useCallback(
    (messageId: string): ChatToolInvocation | null => {
      // Read fresh messages to avoid stale closure
      const messages = useMythosStore.getState().chat.messages;
      const message = messages.find((m) => m.id === messageId);
      return message?.tool ?? null;
    },
    [] // No dependencies - reads fresh state each time
  );

  /**
   * Execute a tool with the given invocation.
   */
  const executeToolInvocation = useCallback(
    async (
      messageId: string,
      invocation: ChatToolInvocation
    ): Promise<ToolRuntimeResult> => {
      const tool = getTool(invocation.toolName);
      if (!tool) {
        updateToolStatus(messageId, "failed", `Unknown tool: ${invocation.toolName}`);
        return { success: false, error: `Unknown tool: ${invocation.toolName}` };
      }

      // Validate args before execution
      if (tool.validate) {
        const validationResult = tool.validate(invocation.args);
        if (!validationResult.valid) {
          updateToolStatus(messageId, "failed", validationResult.error ?? "Invalid arguments");
          return { success: false, error: validationResult.error ?? "Invalid arguments" };
        }
      }

      // Create AbortController for this execution
      const abortController = new AbortController();
      abortControllerRef.current.set(messageId, abortController);

      // Build context with abort signal and messageId for progress updates
      const ctx = buildContext(abortController.signal, messageId);
      if (!ctx) {
        abortControllerRef.current.delete(messageId);
        updateToolStatus(messageId, "failed", "No project selected");
        return { success: false, error: "No project selected" };
      }

      // Update status to executing with startedAt timestamp
      updateToolInvocation(messageId, { status: "executing", startedAt: new Date() });

      try {
        // Execute the tool
        const result: ToolExecutionResult = await tool.execute(invocation.args, ctx);

        // Check if aborted before updating status
        if (abortController.signal.aborted) {
          // Status was already set to "canceled" by cancelTool
          return { success: false, error: "Tool execution was canceled" };
        }

        if (result.success) {
          // Update with success
          updateToolInvocation(messageId, {
            status: "executed",
            result: result.result,
            artifacts: result.artifacts,
          });
          return { success: true };
        } else {
          // Update with failure
          updateToolStatus(messageId, "failed", result.error ?? "Execution failed");
          return { success: false, error: result.error };
        }
      } catch (error) {
        // Check if this was an abort error
        if (abortController.signal.aborted) {
          // Status was already set to "canceled" by cancelTool
          return { success: false, error: "Tool execution was canceled" };
        }

        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        updateToolStatus(messageId, "failed", errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        // Clean up the controller
        abortControllerRef.current.delete(messageId);
      }
    },
    [buildContext, updateToolStatus, updateToolInvocation]
  );

  /**
   * Accept a proposed tool and execute it.
   */
  const acceptTool = useCallback(
    async (messageId: string): Promise<ToolRuntimeResult> => {
      // Prevent double-execution race condition
      if (executingRef.current.has(messageId)) {
        return { success: false, error: "Tool is already executing" };
      }

      const invocation = findToolInvocation(messageId);
      if (!invocation) {
        return { success: false, error: "Tool invocation not found" };
      }

      if (invocation.status !== "proposed") {
        return { success: false, error: `Cannot accept tool in status: ${invocation.status}` };
      }

      // Mark as executing to prevent race condition
      executingRef.current.add(messageId);

      try {
        // Mark as accepted
        updateToolStatus(messageId, "accepted");

        // Execute the tool
        return await executeToolInvocation(messageId, invocation);
      } finally {
        // Clean up executing flag
        executingRef.current.delete(messageId);
      }
    },
    [findToolInvocation, updateToolStatus, executeToolInvocation]
  );

  /**
   * Reject a proposed tool.
   */
  const rejectTool = useCallback(
    (messageId: string): void => {
      const invocation = findToolInvocation(messageId);
      if (!invocation) return;

      if (invocation.status !== "proposed") {
        console.warn(`Cannot reject tool in status: ${invocation.status}`);
        return;
      }

      updateToolStatus(messageId, "rejected");
    },
    [findToolInvocation, updateToolStatus]
  );

  /**
   * Cancel an executing tool.
   */
  const cancelTool = useCallback(
    (messageId: string): void => {
      const invocation = findToolInvocation(messageId);
      if (!invocation) return;

      if (invocation.status !== "executing") {
        console.warn(`Cannot cancel tool in status: ${invocation.status}`);
        return;
      }

      // Abort the controller if one exists (this actually cancels execution)
      const controller = abortControllerRef.current.get(messageId);
      if (controller) {
        controller.abort();
      }

      // Update status to canceled
      updateToolStatus(messageId, "canceled");
    },
    [findToolInvocation, updateToolStatus]
  );

  /**
   * Retry a failed tool.
   */
  const retryTool = useCallback(
    async (messageId: string): Promise<ToolRuntimeResult> => {
      // Prevent double-execution race condition (same guard as acceptTool)
      if (executingRef.current.has(messageId)) {
        return { success: false, error: "Tool is already executing" };
      }

      const invocation = findToolInvocation(messageId);
      if (!invocation) {
        return { success: false, error: "Tool invocation not found" };
      }

      if (invocation.status !== "failed" && invocation.status !== "canceled") {
        return { success: false, error: `Cannot retry tool in status: ${invocation.status}` };
      }

      // Mark as executing to prevent race condition
      executingRef.current.add(messageId);

      try {
        // Increment retry count and reset status/error
        const currentRetryCount = invocation.retryCount ?? 0;
        updateToolInvocation(messageId, {
          status: "accepted",
          error: undefined,
          errorCode: undefined,
          errorStatusCode: undefined,
          retryCount: currentRetryCount + 1,
        });

        return await executeToolInvocation(messageId, invocation);
      } finally {
        // Clean up executing flag
        executingRef.current.delete(messageId);
      }
    },
    [findToolInvocation, updateToolInvocation, executeToolInvocation]
  );

  return {
    acceptTool,
    rejectTool,
    cancelTool,
    retryTool,
    buildContext,
  };
}
