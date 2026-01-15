/**
 * useSagaAgent Hook (Expo Adapter)
 *
 * Wraps the shared Saga agent hook with Expo-specific adapters.
 * Connects to the /ai/saga backend endpoint.
 */

import { useCallback, useMemo } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  useSagaAgent as useSharedSagaAgent,
  type ChatAttachment,
  type SagaAgentMessage,
  type SagaAgentPlatformAdapter,
  type SagaAgentStoreAdapter,
  type UseSagaAgentOptions as SharedUseSagaAgentOptions,
  type UseSagaAgentResult as SharedUseSagaAgentResult,
} from "@mythos/ai/hooks";
import { sendSagaChatStreaming } from "@mythos/ai/client";
import type { SagaMode } from "@mythos/agent-protocol";
import { useAIStore, useProjectStore, type ChatMessage } from "@mythos/state";
import { useApiKey } from "./useApiKey";
import { useArtifactToolHandler } from "./useArtifactToolHandler";

// Base URL for the Saga API
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || "https://convex.rhei.team";

export interface UseSagaAgentOptions {
  enabled?: boolean;
  mode?: SagaMode;
}

export type UseSagaAgentResult = SharedUseSagaAgentResult;

function toChatMessage(message: SagaAgentMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.createdAt.getTime(),
  };
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useSagaAgent(options?: UseSagaAgentOptions): UseSagaAgentResult {
  const { enabled = true, mode = "editing" } = options ?? {};

  // Get project ID from project store
  const projectId = useProjectStore((s) => s.currentProjectId);

  // Get chat state from AI store
  const isStreaming = useAIStore((s) => s.isStreaming);
  const currentThreadId = useAIStore((s) => s.currentThreadId);
  const threads = useAIStore((s) => s.threads);
  const createThread = useAIStore((s) => s.createThread);
  const setStreaming = useAIStore((s) => s.setStreaming);

  // Get auth token and API key
  const { key: apiKey } = useApiKey();
  const authToken = useAuthToken();

  // Artifact tool handler for UI effects
  const { handleTool: handleArtifactTool } = useArtifactToolHandler();

  // Store adapter - maps to useAIStore
  const storeAdapter = useMemo<SagaAgentStoreAdapter>(() => {
    return {
      getProjectId: () => useProjectStore.getState().currentProjectId,
      getConversationId: () => useAIStore.getState().currentThreadId ?? undefined,
      isNewConversation: () => {
        const state = useAIStore.getState();
        return !state.currentThreadId || state.threads.find(t => t.id === state.currentThreadId)?.messages.length === 0;
      },
      getIsStreaming: () => useAIStore.getState().isStreaming,
      getError: () => null, // AI store doesn't track errors currently
      addMessage: (message) => {
        const state = useAIStore.getState();
        let threadId = state.currentThreadId;

        // Create thread if none exists
        if (!threadId) {
          threadId = state.createThread();
        }

        const chatMessage = toChatMessage(message);
        useAIStore.setState((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, chatMessage], updatedAt: Date.now() }
              : t
          ),
        }));
      },
      updateMessage: (id, patch) => {
        useAIStore.setState((s) => ({
          threads: s.threads.map((t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === id
                ? {
                    ...m,
                    ...(patch.content !== undefined && { content: patch.content }),
                  }
                : m
            ),
          })),
        }));
      },
      appendAssistantDelta: (id, delta) => {
        useAIStore.setState((s) => ({
          threads: s.threads.map((t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === id ? { ...m, content: m.content + delta } : m
            ),
          })),
        }));
      },
      setStreaming: (value) => useAIStore.getState().setStreaming(value),
      setError: () => {}, // AI store doesn't track errors currently
      setConversationId: (threadId) => {
        useAIStore.setState({ currentThreadId: threadId });
      },
      startNewConversation: () => {
        useAIStore.getState().createThread();
      },
      clearChat: () => {
        const state = useAIStore.getState();
        if (state.currentThreadId) {
          state.deleteThread(state.currentThreadId);
        }
      },
    };
  }, []);

  // Platform adapter - provides auth, API keys, etc.
  const platformAdapter = useMemo<SagaAgentPlatformAdapter>(() => {
    return {
      getApiKey: () => apiKey ?? undefined,
      getAuthToken: async () => authToken ?? null,
      getExtraHeaders: () => ({}),
      getEditorContext: () => undefined, // TODO: implement editor context for Expo
      getSelectionRange: () => undefined,
      getContextHints: () => undefined, // TODO: implement context hints for Expo
    };
  }, [apiKey, authToken]);

  // Create the sendSagaChatStreaming wrapper with baseUrl and artifact tool handling
  const sendSagaChatStreamingWithBaseUrl = useCallback(
    async (payload: Parameters<typeof sendSagaChatStreaming>[0], opts: Omit<Parameters<typeof sendSagaChatStreaming>[1], "baseUrl">) => {
      return sendSagaChatStreaming(payload, {
        ...opts,
        baseUrl: CONVEX_URL,
        onTool: (tool) => {
          handleArtifactTool(tool);
          opts.onTool?.(tool);
        },
      });
    },
    [handleArtifactTool]
  );

  // Use the shared hook
  const shared = useSharedSagaAgent({
    enabled: enabled && !!projectId,
    initialMode: mode,
    store: storeAdapter,
    platform: platformAdapter,
    sendSagaChatStreaming: sendSagaChatStreamingWithBaseUrl as SharedUseSagaAgentOptions["sendSagaChatStreaming"],
  });

  return {
    ...shared,
    isStreaming,
    error: null,
  };
}
