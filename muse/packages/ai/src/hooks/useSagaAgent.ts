/**
 * Shared Saga agent hook.
 */

import { useCallback, useEffect, useRef } from "react";
import type { ToolApprovalType, ToolName } from "@mythos/agent-protocol";
import { SagaApiError } from "../client/agentClient";
import { createGetErrorMessage, generateMessageId } from "./utils";
import type {
  SagaAgentMessage,
  SagaAgentStreamOptions,
  UseSagaAgentOptions,
  UseSagaAgentResult,
} from "./types";

const getErrorMessage = createGetErrorMessage({
  isApiError: (error): error is SagaApiError => error instanceof SagaApiError,
  getErrorCode: (error) => (error instanceof SagaApiError ? error.sagaCode : undefined),
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

export function useSagaAgent(options: UseSagaAgentOptions): UseSagaAgentResult {
  const { enabled = true, initialMode = "editing", store, platform, sendSagaChatStreaming } = options;

  const abortControllerRef = useRef<AbortController | null>(null);
  const modeRef = useRef(initialMode);

  const pendingSessionMessagesRef = useRef<SagaAgentMessage[]>([]);
  const deferSessionPersistRef = useRef(false);

  const persistSessionMessage = useCallback(
    (message: SagaAgentMessage) => {
      if (!platform.persistMessage) return;
      if (deferSessionPersistRef.current) {
        pendingSessionMessagesRef.current.push(message);
        return;
      }
      platform.persistMessage(message);
    },
    [platform]
  );

  const flushPendingSessionMessages = useCallback(() => {
    if (!platform.persistMessage) return;
    const pending = pendingSessionMessagesRef.current;
    pendingSessionMessagesRef.current = [];
    deferSessionPersistRef.current = false;
    for (const message of pending) {
      platform.persistMessage(message);
    }
  }, [platform]);

  const setMode = useCallback((newMode: UseSagaAgentResult["mode"]) => {
    modeRef.current = newMode;
  }, []);

  const buildEditorContext = useCallback(() => {
    return platform.getEditorContext?.();
  }, [platform]);

  const buildContextHints = useCallback(
    (threadId?: string) => {
      return platform.getContextHints?.(threadId);
    },
    [platform]
  );

  const getSelectionRange = useCallback(() => {
    return platform.getSelectionRange?.();
  }, [platform]);

  const sendMessage: UseSagaAgentResult["sendMessage"] = useCallback(
    async (content, options) => {
      if (!enabled) return;

      const projectId = store.getProjectId();
      if (!projectId) {
        store.setError("No project selected.");
        return;
      }

      if (!content.trim()) return;

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const userMessage: SagaAgentMessage = {
        id: generateMessageId(),
        role: "user",
        content: content.trim(),
        createdAt: new Date(),
        mentions: options?.mentions,
        attachments: options?.attachments,
      };

      const wasNewConversation = store.isNewConversation() || !store.getConversationId();
      const existingThreadId = store.getConversationId();

      store.addMessage(userMessage);

      deferSessionPersistRef.current = wasNewConversation;
      persistSessionMessage(userMessage);

      const assistantMessageId = generateMessageId();
      const assistantMessage: SagaAgentMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        isStreaming: true,
      };

      store.addMessage(assistantMessage);
      store.setStreaming(true);
      store.setError(null);

      try {
        const threadId = wasNewConversation ? undefined : existingThreadId;
        const contextHints = buildContextHints(threadId);

        const payload = {
          prompt: content.trim(),
          projectId,
          mentions: options?.mentions,
          editorContext: buildEditorContext(),
          contextHints,
          mode: modeRef.current,
          threadId,
          attachments: options?.attachments?.map((attachment) => {
            if (attachment.kind !== "image") return attachment;
            const { dataUrl, ...rest } = attachment;
            if (!rest.url && dataUrl) {
              return { ...rest, url: dataUrl };
            }
            return rest;
          }),
        };

        let assistantContent = "";

        const streamOptions: SagaAgentStreamOptions = {
          signal: abortController.signal,
          apiKey: platform.getApiKey?.(),
          authToken: (await platform.getAuthToken?.()) ?? undefined,
          extraHeaders: platform.getExtraHeaders?.(),
          onContext: (context) => {
            const newThreadId = context.threadId;
            if (newThreadId && newThreadId !== store.getConversationId()) {
              store.setConversationId(newThreadId);
              if (deferSessionPersistRef.current) {
                flushPendingSessionMessages();
              }
            }
          },
          onDelta: (delta) => {
            assistantContent += delta;
            store.appendAssistantDelta(assistantMessageId, delta);
          },
          onTool: (tool) => {
            const approvalType = resolveDefaultApprovalType(tool.toolName as ToolName);
            const needsApproval = approvalType !== undefined;
            const selectionRange =
              tool.toolName === "write_content" ? getSelectionRange() : undefined;

            const toolMessage: SagaAgentMessage = {
              id: tool.toolCallId,
              role: "assistant",
              content: "",
              createdAt: new Date(),
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
            store.addMessage(toolMessage);
            persistSessionMessage(toolMessage);
          },
          onToolApprovalRequest: (request) => {
            const toolCallId = request.toolCallId ?? request.approvalId;
            if (!toolCallId) {
              console.warn("[useSagaAgent] tool-approval-request missing IDs");
              return;
            }
            const selectionRange =
              request.toolName === "write_content" ? getSelectionRange() : undefined;
            const toolMessage: SagaAgentMessage = {
              id: toolCallId,
              role: "assistant",
              content: "",
              createdAt: new Date(),
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
            store.addMessage(toolMessage);
            persistSessionMessage(toolMessage);
          },
          onProgress: (toolCallId, progress) => {
            store.updateToolProgress?.(toolCallId, { pct: progress.pct, stage: progress.stage });
          },
          onDone: () => {
            store.updateMessage(assistantMessageId, { isStreaming: false });
            store.setStreaming(false);
            if (assistantContent) {
              persistSessionMessage({
                ...assistantMessage,
                content: assistantContent,
                isStreaming: false,
              });
            }
          },
          onError: (err) => {
            const message = getErrorMessage(err);
            if (message) {
              store.setError(message);
            }
            store.updateMessage(assistantMessageId, {
              isStreaming: false,
              content: assistantContent || "Sorry, I encountered an error.",
            });
            store.setStreaming(false);
          },
        };

        await sendSagaChatStreaming(payload, streamOptions);
      } catch (err) {
        if (abortController.signal.aborted) {
          store.updateMessage(assistantMessageId, { isStreaming: false });
          store.setStreaming(false);
          return;
        }

        const message = getErrorMessage(err);
        if (message) {
          store.setError(message);
        }
        store.updateMessage(assistantMessageId, {
          isStreaming: false,
          content: "Sorry, I encountered an error. Please try again.",
        });
        store.setStreaming(false);
      }
    },
    [
      enabled,
      store,
      platform,
      buildEditorContext,
      buildContextHints,
      getSelectionRange,
      persistSessionMessage,
      flushPendingSessionMessages,
      sendSagaChatStreaming,
    ]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    store.setStreaming(false);
  }, [store]);

  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    store.clearChat();
  }, [store]);

  const newConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    store.startNewConversation();
  }, [store]);

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
    isStreaming: store.getIsStreaming(),
    error: store.getError(),
    setMode,
    mode: modeRef.current,
  };
}
