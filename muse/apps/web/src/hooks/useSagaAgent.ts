/**
 * useSagaAgent Hook
 *
 * Orchestrates Saga AI agent with streaming support and tool proposals.
 *
 * Features:
 * - Send messages with automatic editor context injection
 * - Stream responses with tool proposals in real-time
 * - Handle @mentions for explicit context
 * - Support saga modes (onboarding, creation, editing, analysis)
 * - Integrate with existing tool lifecycle (accept/reject/execute)
 */

import { useCallback, useRef, useEffect } from "react";
import {
  useMythosStore,
  type ChatMessage,
  type ChatMention,
  type ChatContext,
} from "../stores";
import {
  sendSagaChatStreaming,
  SagaApiError,
  type SagaChatPayload,
  type SagaMode,
  type EditorContext,
  type ToolCallResult,
} from "../services/ai/sagaClient";
import { useEditorChatContext } from "./useEditorChatContext";
import { useApiKey } from "./useApiKey";
import type { ToolName } from "@mythos/agent-protocol";

/**
 * Options for the useSagaAgent hook
 */
export interface UseSagaAgentOptions {
  /** Enable the hook (default: true) */
  enabled?: boolean;
  /** Current saga mode for context-aware prompts */
  mode?: SagaMode;
}

/**
 * Return type for the useSagaAgent hook
 */
export interface UseSagaAgentResult {
  /** Send a message and stream the response */
  sendMessage: (content: string, mentions?: ChatMention[]) => Promise<void>;
  /** Stop streaming the current response */
  stopStreaming: () => void;
  /** Clear all messages and start fresh */
  clearChat: () => void;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Current error if any */
  error: string | null;
  /** Set the current saga mode */
  setMode: (mode: SagaMode) => void;
  /** Current saga mode */
  mode: SagaMode;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof SagaApiError) {
    switch (error.sagaCode) {
      case "UNAUTHORIZED":
        return "Please configure your API key in settings.";
      case "RATE_LIMITED":
        return "Too many requests. Please wait a moment.";
      case "ABORTED":
        return ""; // Don't show error for aborted requests
      case "VALIDATION_ERROR":
        return error.message;
      case "TOOL_ERROR":
        return `Tool error: ${error.message}`;
      case "TOOL_EXECUTION_ERROR":
        return `Execution failed: ${error.message}`;
      default:
        return `Saga error: ${error.message}`;
    }
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return ""; // Don't show error for aborted requests
    }
    return `Saga error: ${error.message}`;
  }

  return "An unexpected error occurred.";
}

/**
 * Hook for Saga AI agent functionality with tool proposals.
 *
 * Extends the base chat agent with:
 * - Editor context injection (document title, selection)
 * - Saga modes for context-aware prompts
 * - Tool proposal lifecycle integration
 */
export function useSagaAgent(options?: UseSagaAgentOptions): UseSagaAgentResult {
  const { enabled = true, mode: initialMode = "editing" } = options ?? {};

  // Store state and actions
  const currentProject = useMythosStore((s) => s.project.currentProject);
  const isStreaming = useMythosStore((s) => s.chat.isStreaming);
  const error = useMythosStore((s) => s.chat.error);

  const addChatMessage = useMythosStore((s) => s.addChatMessage);
  const updateChatMessage = useMythosStore((s) => s.updateChatMessage);
  const appendToChatMessage = useMythosStore((s) => s.appendToChatMessage);
  const setChatStreaming = useMythosStore((s) => s.setChatStreaming);
  const setChatError = useMythosStore((s) => s.setChatError);
  const setChatContext = useMythosStore((s) => s.setChatContext);
  const startNewConversation = useMythosStore((s) => s.startNewConversation);
  const updateToolInvocation = useMythosStore((s) => s.updateToolInvocation);

  // Get API key
  const { key: apiKey } = useApiKey();

  // Get editor context (document info, selection)
  const editorChatContext = useEditorChatContext();

  // Ref for abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref for current mode (avoids re-renders for mode changes)
  const modeRef = useRef<SagaMode>(initialMode);

  /**
   * Set the current saga mode
   */
  const setMode = useCallback((newMode: SagaMode) => {
    modeRef.current = newMode;
  }, []);

  /**
   * Build editor context for the API call
   */
  const buildEditorContext = useCallback((): EditorContext | undefined => {
    const ctx = editorChatContext;
    if (!ctx.document && !ctx.selection) return undefined;

    return {
      documentTitle: ctx.document?.title,
      selectionText: ctx.selection?.text,
    };
  }, [editorChatContext]);

  /**
   * Send a message and stream the response
   */
  const sendMessage = useCallback(
    async (content: string, mentions?: ChatMention[]) => {
      if (!enabled) return;

      const projectId = currentProject?.id;
      if (!projectId) {
        setChatError("No project selected.");
        return;
      }

      if (!content.trim()) {
        return;
      }

      // Abort any in-flight request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Create user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
        mentions,
      };

      // Add user message to store
      addChatMessage(userMessage);

      // Create placeholder for assistant response
      const assistantMessageId = generateMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      addChatMessage(assistantMessage);
      setChatStreaming(true);
      setChatError(null);

      try {
        // Build messages array for API (excluding placeholder and tool messages)
        const currentMessages = useMythosStore.getState().chat.messages;
        const apiMessages: SagaChatPayload["messages"] = currentMessages
          .filter((m) => m.role !== "system" && !m.isStreaming && m.kind !== "tool")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Build the payload with editor context
        const payload: SagaChatPayload = {
          messages: apiMessages,
          projectId,
          mentions,
          editorContext: buildEditorContext(),
          mode: modeRef.current,
        };

        await sendSagaChatStreaming(payload, {
          signal: abortController.signal,
          apiKey: apiKey ?? undefined,
          onContext: (context: ChatContext) => {
            setChatContext(context);
          },
          onDelta: (delta: string) => {
            appendToChatMessage(assistantMessageId, delta);
          },
          onTool: (tool: ToolCallResult) => {
            // Create a tool message with the stable toolCallId from the LLM
            const toolMessage: ChatMessage = {
              id: tool.toolCallId, // Use the stable ID from the LLM
              role: "assistant",
              content: "",
              timestamp: new Date(),
              kind: "tool",
              tool: {
                toolCallId: tool.toolCallId,
                toolName: tool.toolName as ToolName,
                args: tool.args,
                status: "proposed",
              },
            };
            addChatMessage(toolMessage);
          },
          onProgress: (toolCallId: string, progress) => {
            // Update tool progress for long-running operations
            updateToolInvocation(toolCallId, { progress });
          },
          onDone: () => {
            updateChatMessage(assistantMessageId, { isStreaming: false });
            setChatStreaming(false);
          },
          onError: (err: Error) => {
            const message = getErrorMessage(err);
            if (message) {
              setChatError(message);
            }
            updateChatMessage(assistantMessageId, {
              isStreaming: false,
              content: assistantMessage.content || "Sorry, I encountered an error.",
            });
            setChatStreaming(false);
          },
        });
      } catch (err) {
        // Handle errors not caught by onError callback
        if (abortController.signal.aborted) {
          // Request was aborted, update message state
          updateChatMessage(assistantMessageId, { isStreaming: false });
          setChatStreaming(false);
          return;
        }

        const message = getErrorMessage(err);
        if (message) {
          setChatError(message);
        }
        updateChatMessage(assistantMessageId, {
          isStreaming: false,
          content: "Sorry, I encountered an error. Please try again.",
        });
        setChatStreaming(false);
      }
    },
    [
      enabled,
      currentProject?.id,
      apiKey,
      addChatMessage,
      updateChatMessage,
      appendToChatMessage,
      setChatStreaming,
      setChatError,
      setChatContext,
      updateToolInvocation,
      buildEditorContext,
    ]
  );

  /**
   * Stop streaming the current response
   */
  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setChatStreaming(false);
  }, [setChatStreaming]);

  /**
   * Clear chat and start fresh
   */
  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    startNewConversation();
  }, [startNewConversation]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    sendMessage,
    stopStreaming,
    clearChat,
    isStreaming,
    error,
    setMode,
    mode: modeRef.current,
  };
}
