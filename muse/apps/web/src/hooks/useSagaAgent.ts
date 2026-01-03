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
 *
 * Built using createAgentHook factory for consistency with other agent hooks.
 */

import { useCallback, useRef, useEffect } from "react";
import {
  generateMessageId,
  createGetErrorMessage,
  type BaseMessagePayload,
  type ToolCallResult,
} from "./createAgentHook";
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
  type ToolApprovalRequest,
} from "../services/ai/sagaClient";
import { useEditorChatContext } from "./useEditorChatContext";
import { useApiKey } from "./useApiKey";
import type { ToolName } from "@mythos/agent-protocol";
import {
  buildContextHints as buildUnifiedContextHints,
  buildProjectPersonalizationContext,
  isContextHintsEmpty,
} from "@mythos/context";
import { useAuthStore } from "../stores/auth";
import { useAnonymousStore } from "../stores/anonymous";
import type { SagaSessionWriter } from "./useSessionHistory";

/**
 * Options for the useSagaAgent hook
 */
export interface UseSagaAgentOptions {
  /** Enable the hook (default: true) */
  enabled?: boolean;
  /** Current saga mode for context-aware prompts */
  mode?: SagaMode;
  /** Optional session writer for DB persistence */
  sessionWriter?: SagaSessionWriter;
}

/**
 * Return type for the useSagaAgent hook
 */
export interface UseSagaAgentResult {
  /** Send a message and stream the response */
  sendMessage: (content: string, mentions?: ChatMention[]) => Promise<void>;
  /** Stop streaming the current response */
  stopStreaming: () => void;
  /** Clear messages (keeps same conversation) */
  clearChat: () => void;
  /** Start a new conversation (new ID, clears messages) */
  newConversation: () => void;
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
 * Error message handler for Saga errors
 */
const getErrorMessage = createGetErrorMessage({
  isApiError: (error): error is SagaApiError => error instanceof SagaApiError,
  getErrorCode: (error) =>
    error instanceof SagaApiError ? error.sagaCode : undefined,
  errorPrefix: "Saga error",
  errorCodeMessages: {
    TOOL_ERROR: "Tool error occurred.",
    TOOL_EXECUTION_ERROR: "Execution failed.",
  },
});

/**
 * Hook for Saga AI agent functionality with tool proposals.
 *
 * Extends the base chat agent with:
 * - Editor context injection (document title, selection)
 * - Saga modes for context-aware prompts
 * - Tool proposal lifecycle integration
 */
export function useSagaAgent(options?: UseSagaAgentOptions): UseSagaAgentResult {
  const { enabled = true, mode: initialMode = "editing", sessionWriter } = options ?? {};

  // Store state and actions
  const currentProject = useMythosStore((s) => s.project.currentProject);
  const isStreaming = useMythosStore((s) => s.chat.isStreaming);
  const error = useMythosStore((s) => s.chat.error);
  const authUser = useAuthStore((s) => s.user);
  const anonPersonalization = useAnonymousStore((s) => s.personalization);

  const addChatMessage = useMythosStore((s) => s.addChatMessage);
  const updateChatMessage = useMythosStore((s) => s.updateChatMessage);
  const appendToChatMessage = useMythosStore((s) => s.appendToChatMessage);
  const setChatStreaming = useMythosStore((s) => s.setChatStreaming);
  const setChatError = useMythosStore((s) => s.setChatError);
  const setChatContext = useMythosStore((s) => s.setChatContext);
  const startNewConversation = useMythosStore((s) => s.startNewConversation);
  const clearChatMessages = useMythosStore((s) => s.clearChat);
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

  const buildContextHintsPayload = useCallback(
    (conversationId?: string) => {
      const state = useMythosStore.getState();
      const editorContext = buildEditorContext();

      const anonProfilePreferences = anonPersonalization
        ? {
            writing: {
              preferredGenre: anonPersonalization.genre?.trim() || undefined,
              smartMode: anonPersonalization.smartMode,
            },
          }
        : undefined;

      const projectContext = buildProjectPersonalizationContext({
        genre: currentProject?.config.genre ?? anonPersonalization?.genre,
        styleMode: currentProject?.config.styleMode,
        guardrails: currentProject?.config.guardrails ?? anonPersonalization?.guardrails,
        smartMode: currentProject?.config.smartMode ?? anonPersonalization?.smartMode,
      });

      const hints = buildUnifiedContextHints({
        profilePreferences: authUser?.preferences ?? anonProfilePreferences,
        entities: Array.from(state.world.entities.values()),
        relationships: state.world.relationships,
        editorContext,
        conversationId,
        projectContext,
      });

      return isContextHintsEmpty(hints) ? undefined : hints;
    },
    [buildEditorContext, anonPersonalization, authUser?.preferences, currentProject?.config]
  );

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

      // Persist user message to DB (fire-and-forget)
      sessionWriter?.persistUserMessage?.(userMessage);

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
        const apiMessages: BaseMessagePayload[] = currentMessages
          .filter((m) => m.role !== "system" && !m.isStreaming && m.kind !== "tool")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Get conversationId from store (single source of truth)
        const conversationId = useMythosStore.getState().chat.conversationId;

        const contextHints = buildContextHintsPayload(conversationId);

        // Build the payload with editor context
        const payload: SagaChatPayload = {
          messages: apiMessages,
          projectId,
          mentions,
          editorContext: buildEditorContext(),
          contextHints,
          mode: modeRef.current,
          conversationId,
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
            // Regular tool call (no approval needed or auto-approved)
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
            // Persist tool message to DB (fire-and-forget)
            sessionWriter?.persistToolMessage?.(toolMessage);
          },
          onToolApprovalRequest: (request: ToolApprovalRequest) => {
            // AI SDK 6: Tool needs user approval before execution
            // Create a tool message in "proposed" state (same as regular tools)
            // The ToolResultCard will show approval UI
            const toolCallId = request.toolCallId ?? request.approvalId;
            if (!toolCallId) {
              console.warn("[useSagaAgent] tool-approval-request missing IDs");
              return;
            }
            const toolMessage: ChatMessage = {
              id: toolCallId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              kind: "tool",
              tool: {
                toolCallId,
                approvalId: request.approvalId,
                toolName: request.toolName as ToolName,
                args: request.args,
                status: "proposed",
                // Flag to indicate this came from SDK-level approval
                needsApproval: true,
              },
            };
            addChatMessage(toolMessage);
            // Persist tool message to DB (fire-and-forget)
            sessionWriter?.persistToolMessage?.(toolMessage);
          },
          onProgress: (toolCallId: string, progress) => {
            // Update tool progress for long-running operations
            updateToolInvocation(toolCallId, { progress });
          },
          onDone: () => {
            updateChatMessage(assistantMessageId, { isStreaming: false });
            setChatStreaming(false);
            // Persist final assistant message to DB (fire-and-forget)
            const currentMsgs = useMythosStore.getState().chat.messages;
            const finalMessage = currentMsgs.find(m => m.id === assistantMessageId);
            if (finalMessage && finalMessage.content) {
              sessionWriter?.persistAssistantMessage?.(finalMessage);
            }
          },
          onError: (err: Error) => {
            const message = getErrorMessage(err);
            if (message) {
              setChatError(message);
            }
            // Read current content from store to avoid stale closure
            const currentMsgs = useMythosStore.getState().chat.messages;
            const currentMessage = currentMsgs.find(m => m.id === assistantMessageId);
            updateChatMessage(assistantMessageId, {
              isStreaming: false,
              content: currentMessage?.content || "Sorry, I encountered an error.",
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
      sessionWriter,
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
   * Clear chat messages (keeps same conversation ID)
   */
  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    clearChatMessages();
  }, [clearChatMessages]);

  /**
   * Start a new conversation (new ID, clears messages)
   */
  const newConversation = useCallback(() => {
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
    newConversation,
    isStreaming,
    error,
    setMode,
    mode: modeRef.current,
  };
}
