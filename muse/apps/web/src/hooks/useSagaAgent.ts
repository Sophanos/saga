/**
 * useSagaAgent Hook (Web Adapter)
 *
 * Wraps the shared Saga agent hook with web-specific adapters.
 */

import { useCallback, useMemo } from "react";
import {
  useSagaAgent as useSharedSagaAgent,
  type ChatAttachment,
  type SagaAgentMessage,
  type SagaAgentPlatformAdapter,
  type SagaAgentStoreAdapter,
  type UseSagaAgentOptions as SharedUseSagaAgentOptions,
  type UseSagaAgentResult as SharedUseSagaAgentResult,
} from "@mythos/ai/hooks";
import {
  buildContextHints as buildUnifiedContextHints,
  buildProjectPersonalizationContext,
  isContextHintsEmpty,
} from "@mythos/context";
import type { EditorContext, SagaMode } from "@mythos/agent-protocol";
import {
  useMythosStore,
  type ChatMessage,
  type ChatMention,
} from "../stores";
import { sendSagaChatStreaming } from "../services/ai/agentRuntimeClient";
import { useEditorChatContext } from "./useEditorChatContext";
import { useApiKey } from "./useApiKey";
import { useAuthStore } from "../stores/auth";
import { useAnonymousStore } from "../stores/anonymous";
import { getAnonHeaders } from "../services/anonymousSession";
import { getConvexToken } from "../lib/tokenCache";
import type { SagaSessionWriter } from "./useSessionHistory";

export interface UseSagaAgentOptions {
  enabled?: boolean;
  mode?: SagaMode;
  sessionWriter?: SagaSessionWriter;
}

export interface UseSagaAgentResult extends Omit<SharedUseSagaAgentResult, "sendMessage"> {
  sendMessage: (
    content: string,
    options?: { mentions?: ChatMention[]; attachments?: ChatAttachment[] }
  ) => Promise<void>;
}

function toChatMessage(message: SagaAgentMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.createdAt,
    mentions: message.mentions as ChatMention[] | undefined,
    attachments: message.attachments,
    kind: message.kind,
    tool: message.tool,
    isStreaming: message.isStreaming,
  };
}

function toChatMessagePatch(patch: Partial<SagaAgentMessage>): Partial<ChatMessage> {
  const next: Partial<ChatMessage> = {
    ...patch,
    mentions: patch.mentions as ChatMention[] | undefined,
  } as Partial<ChatMessage>;
  if (patch.createdAt) {
    next.timestamp = patch.createdAt;
  }
  delete (next as { createdAt?: Date }).createdAt;
  return next;
}

export function useSagaAgent(options?: UseSagaAgentOptions): UseSagaAgentResult {
  const { enabled = true, mode = "editing", sessionWriter } = options ?? {};

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
  const setThreadId = useMythosStore((s) => s.setThreadId);
  const startNewConversation = useMythosStore((s) => s.startNewConversation);
  const clearChatMessages = useMythosStore((s) => s.clearChat);
  const updateToolInvocation = useMythosStore((s) => s.updateToolInvocation);

  const { key: apiKey } = useApiKey();
  const editorChatContext = useEditorChatContext();

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

  const storeAdapter = useMemo<SagaAgentStoreAdapter>(() => {
    return {
      getProjectId: () => useMythosStore.getState().project.currentProject?.id ?? null,
      getConversationId: () => useMythosStore.getState().chat.conversationId ?? undefined,
      isNewConversation: () => {
        const state = useMythosStore.getState().chat;
        return state.isNewConversation || !state.conversationId;
      },
      getIsStreaming: () => useMythosStore.getState().chat.isStreaming,
      getError: () => useMythosStore.getState().chat.error,
      addMessage: (message) => addChatMessage(toChatMessage(message)),
      updateMessage: (id, patch) => updateChatMessage(id, toChatMessagePatch(patch)),
      appendAssistantDelta: (id, delta) => appendToChatMessage(id, delta),
      setStreaming: (value) => setChatStreaming(value),
      setError: (value) => setChatError(value),
      setConversationId: (threadId) => setThreadId(threadId),
      updateToolProgress: (toolCallId, progress) => updateToolInvocation(toolCallId, { progress }),
      startNewConversation: () => startNewConversation(),
      clearChat: () => clearChatMessages(),
    };
  }, [
    addChatMessage,
    updateChatMessage,
    appendToChatMessage,
    setChatStreaming,
    setChatError,
    setThreadId,
    updateToolInvocation,
    startNewConversation,
    clearChatMessages,
  ]);

  const platformAdapter = useMemo<SagaAgentPlatformAdapter>(() => {
    const persistMessage = sessionWriter
      ? (message: SagaAgentMessage) => {
          if (message.kind === "tool") {
            sessionWriter.persistToolMessage?.(toChatMessage(message));
          } else if (message.role === "user") {
            sessionWriter.persistUserMessage?.(toChatMessage(message));
          } else {
            sessionWriter.persistAssistantMessage?.(toChatMessage(message));
          }
        }
      : undefined;

    return {
      getApiKey: () => apiKey ?? undefined,
      getAuthToken: async () => getConvexToken(),
      getExtraHeaders: () => getAnonHeaders(),
      getEditorContext: () => buildEditorContext(),
      getSelectionRange,
      getContextHints: buildContextHintsPayload,
      persistMessage,
    };
  }, [apiKey, buildEditorContext, getSelectionRange, buildContextHintsPayload, sessionWriter]);

  const shared = useSharedSagaAgent({
    enabled,
    initialMode: mode,
    store: storeAdapter,
    platform: platformAdapter,
    sendSagaChatStreaming: sendSagaChatStreaming as SharedUseSagaAgentOptions["sendSagaChatStreaming"],
  });

  return {
    ...shared,
    isStreaming,
    error,
  };
}
