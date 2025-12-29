/**
 * useToolRuntime Hook
 *
 * Central runtime for executing AI agent tools.
 * Manages tool lifecycle, status updates, and execution.
 *
 * This hook decouples tool execution from UI components,
 * allowing tools to be executed from any surface (chat, command palette, etc.)
 */

import { useCallback } from "react";
import { useMythosStore, type ChatToolInvocation } from "../stores";
import { useEntityPersistence } from "./useEntityPersistence";
import { useRelationshipPersistence } from "./useRelationshipPersistence";
import { getTool, type ToolExecutionContext, type ToolExecutionResult } from "../tools";

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
  /** Cancel an executing tool */
  cancelTool: (messageId: string) => void;
  /** Retry a failed tool */
  retryTool: (messageId: string) => Promise<ToolRuntimeResult>;
  /** Build execution context (for advanced use cases) */
  buildContext: () => ToolExecutionContext | null;
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
  // Store state and actions
  const projectId = useMythosStore((s) => s.project.currentProject?.id);
  const entities = useMythosStore((s) => s.world.entities);
  const relationships = useMythosStore((s) => s.world.relationships);
  const messages = useMythosStore((s) => s.chat.messages);

  const updateToolStatus = useMythosStore((s) => s.updateToolStatus);
  const updateToolInvocation = useMythosStore((s) => s.updateToolInvocation);
  const addEntity = useMythosStore((s) => s.addEntity);
  const removeEntity = useMythosStore((s) => s.removeEntity);
  const addRelationship = useMythosStore((s) => s.addRelationship);
  const removeRelationship = useMythosStore((s) => s.removeRelationship);

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

  /**
   * Build execution context with all dependencies.
   */
  const buildContext = useCallback((): ToolExecutionContext | null => {
    if (!projectId) return null;

    return {
      projectId,
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
      // Store actions
      addEntity,
      addRelationship,
      removeEntity,
      removeRelationship,
    };
  }, [
    projectId,
    entities,
    relationships,
    createEntity,
    persistUpdateEntity,
    deleteEntity,
    createRelationship,
    persistUpdateRelationship,
    deleteRelationship,
    addEntity,
    addRelationship,
    removeEntity,
    removeRelationship,
  ]);

  /**
   * Find tool invocation from a message.
   */
  const findToolInvocation = useCallback(
    (messageId: string): ChatToolInvocation | null => {
      const message = messages.find((m) => m.id === messageId);
      return message?.tool ?? null;
    },
    [messages]
  );

  /**
   * Execute a tool with the given invocation.
   */
  const executeToolInvocation = useCallback(
    async (
      messageId: string,
      invocation: ChatToolInvocation
    ): Promise<ToolRuntimeResult> => {
      const ctx = buildContext();
      if (!ctx) {
        updateToolStatus(messageId, "failed", "No project selected");
        return { success: false, error: "No project selected" };
      }

      const tool = getTool(invocation.toolName);
      if (!tool) {
        updateToolStatus(messageId, "failed", `Unknown tool: ${invocation.toolName}`);
        return { success: false, error: `Unknown tool: ${invocation.toolName}` };
      }

      // Update status to executing
      updateToolInvocation(messageId, { status: "executing" });

      try {
        // Execute the tool
        const result: ToolExecutionResult = await tool.execute(invocation.args, ctx);

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
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        updateToolStatus(messageId, "failed", errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [buildContext, updateToolStatus, updateToolInvocation]
  );

  /**
   * Accept a proposed tool and execute it.
   */
  const acceptTool = useCallback(
    async (messageId: string): Promise<ToolRuntimeResult> => {
      const invocation = findToolInvocation(messageId);
      if (!invocation) {
        return { success: false, error: "Tool invocation not found" };
      }

      if (invocation.status !== "proposed") {
        return { success: false, error: `Cannot accept tool in status: ${invocation.status}` };
      }

      // Mark as accepted
      updateToolStatus(messageId, "accepted");

      // Execute the tool
      return executeToolInvocation(messageId, invocation);
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

      updateToolStatus(messageId, "canceled");
    },
    [findToolInvocation, updateToolStatus]
  );

  /**
   * Retry a failed tool.
   */
  const retryTool = useCallback(
    async (messageId: string): Promise<ToolRuntimeResult> => {
      const invocation = findToolInvocation(messageId);
      if (!invocation) {
        return { success: false, error: "Tool invocation not found" };
      }

      if (invocation.status !== "failed" && invocation.status !== "canceled") {
        return { success: false, error: `Cannot retry tool in status: ${invocation.status}` };
      }

      // Reset to accepted and re-execute
      updateToolStatus(messageId, "accepted");

      return executeToolInvocation(messageId, invocation);
    },
    [findToolInvocation, updateToolStatus, executeToolInvocation]
  );

  return {
    acceptTool,
    rejectTool,
    cancelTool,
    retryTool,
    buildContext,
  };
}
