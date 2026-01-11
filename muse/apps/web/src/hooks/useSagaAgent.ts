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
} from "../services/ai/agentRuntimeClient";
import { useEditorChatContext } from "./useEditorChatContext";
import { useApiKey } from "./useApiKey";
import type { ToolName, ToolApprovalType } from "@mythos/agent-protocol";
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

function resolveDefaultApprovalType(toolName: ToolName): ToolApprovalType | undefined {
  if (toolName === "ask_question") return "input";
  if (toolName === "write_content") return "apply";
  return undefined;
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
  const setThreadId = useMythosStore((s) => s.setThreadId);
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

  // Pending session persistence for server-assigned thread IDs
  const pendingSessionMessagesRef = useRef<ChatMessage[]>([]);
  const deferSessionPersistRef = useRef(false);

  const persistSessionMessage = useCallback(
    (message: ChatMessage) => {
      if (!sessionWriter) return;
      if (deferSessionPersistRef.current) {
        pendingSessionMessagesRef.current.push(message);
        return;
      }
      if (message.kind === "tool") {
        sessionWriter.persistToolMessage?.(message);
      } else if (message.role === "user") {
        sessionWriter.persistUserMessage?.(message);
      } else {
        sessionWriter.persistAssistantMessage?.(message);
      }
    },
    [sessionWriter]
  );

  const flushPendingSessionMessages = useCallback(() => {
    if (!sessionWriter) return;
    const pending = pendingSessionMessagesRef.current;
    pendingSessionMessagesRef.current = [];
    deferSessionPersistRef.current = false;
    for (const message of pending) {
      if (message.kind === "tool") {
        sessionWriter.persistToolMessage?.(message);
      } else if (message.role === "user") {
        sessionWriter.persistUserMessage?.(message);
      } else {
        sessionWriter.persistAssistantMessage?.(message);
      }
    }
  }, [sessionWriter]);

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

    const selectionText = ctx.selection?.text?.trim();
    const selectionContext = selectionText ? ctx.selection?.surroundingContext?.trim() : undefined;
    const documentExcerpt = !selectionText ? ctx.document?.excerpt?.trim() : undefined;

    return {
      documentId: ctx.document?.id,
      documentTitle: ctx.document?.title,
      documentExcerpt: documentExcerpt || undefined,
      selectionText: selectionText || undefined,
      selectionContext: selectionContext || undefined,
    };
  }, [editorChatContext]);

  const getSelectionRange = useCallback(() => {
    const editor = useMythosStore.getState().editor.editorInstance as
      | { state: { selection: { from: number; to: number } }; isDestroyed?: boolean }
      | null;
    if (!editor || editor.isDestroyed) return undefined;
    const { from, to } = editor.state.selection;
    return { from, to };
  }, []);

  const buildContextHintsPayload = useCallback(
    (threadId?: string) => {
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
        conversationId: threadId,
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

      const stateBefore = useMythosStore.getState();
      const wasNewConversation =
        stateBefore.chat.isNewConversation || !stateBefore.chat.conversationId;
      const existingThreadId = stateBefore.chat.conversationId ?? undefined;

      // Add user message to store
      addChatMessage(userMessage);

      deferSessionPersistRef.current = wasNewConversation;
      persistSessionMessage(userMessage);

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
        const threadId = wasNewConversation ? undefined : existingThreadId;

        const contextHints = buildContextHintsPayload(threadId);

        const payload: SagaChatPayload = {
          prompt: content.trim(),
          projectId,
          mentions,
          editorContext: buildEditorContext(),
          contextHints,
          mode: modeRef.current,
          threadId,
        };

        await sendSagaChatStreaming(payload, {
          signal: abortController.signal,
          apiKey: apiKey ?? undefined,
          onContext: (context: ChatContext) => {
            setChatContext(context);
            const threadId = context.threadId;
            if (threadId && threadId !== useMythosStore.getState().chat.conversationId) {
              setThreadId(threadId);
              if (deferSessionPersistRef.current) {
                flushPendingSessionMessages();
              }
            }
          },
          onDelta: (delta: string) => {
            appendToChatMessage(assistantMessageId, delta);
          },
          onTool: (tool: ToolCallResult) => {
            const approvalType = resolveDefaultApprovalType(tool.toolName as ToolName);
            const needsApproval = approvalType !== undefined;
            const selectionRange =
              tool.toolName === "write_content" ? getSelectionRange() : undefined;

            const toolMessage: ChatMessage = {
              id: tool.toolCallId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              kind: "tool",
              tool: {
                toolCallId: tool.toolCallId,
                toolName: tool.toolName as ToolName,
                args: tool.args,
                promptMessageId: tool.promptMessageId,
                selectionRange,
                status: "proposed",
                needsApproval,
                approvalType,
              },
            };
            addChatMessage(toolMessage);
            persistSessionMessage(toolMessage);
          },
          onToolApprovalRequest: (request: ToolApprovalRequest) => {
            // AI SDK 6: Tool needs user approval before execution
            const toolCallId = request.toolCallId ?? request.approvalId;
            if (!toolCallId) {
              console.warn("[useSagaAgent] tool-approval-request missing IDs");
              return;
            }
            const selectionRange =
              request.toolName === "write_content" ? getSelectionRange() : undefined;
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
                approvalType: request.approvalType,
                danger: request.danger,
                promptMessageId: request.promptMessageId,
                selectionRange,
                status: "proposed",
                needsApproval: true,
              },
            };
            addChatMessage(toolMessage);
            persistSessionMessage(toolMessage);
          },
          onProgress: (toolCallId: string, progress) => {
            // Update tool progress for long-running operations
            updateToolInvocation(toolCallId, { progress });
          },
          onDone: () => {
            updateChatMessage(assistantMessageId, { isStreaming: false });
            setChatStreaming(false);
            const currentMsgs = useMythosStore.getState().chat.messages;
            const finalMessage = currentMsgs.find(m => m.id === assistantMessageId);
            if (finalMessage && finalMessage.content) {
              persistSessionMessage(finalMessage);
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
      // isNewConversation is read via stateBefore to avoid post-mutation flips
      addChatMessage,
      updateChatMessage,
      appendToChatMessage,
      setChatStreaming,
      setChatError,
      setChatContext,
      setThreadId,
      updateToolInvocation,
      buildEditorContext,
      buildContextHintsPayload,
      getSelectionRange,
      persistSessionMessage,
      flushPendingSessionMessages,
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
