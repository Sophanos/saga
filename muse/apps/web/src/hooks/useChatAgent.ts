/**
 * useChatAgent Hook
 *
 * Orchestrates RAG-powered chat with streaming support.
 *
 * Features:
 * - Send messages with automatic RAG context retrieval
 * - Stream responses in real-time
 * - Handle @mentions for explicit context injection
 * - Abort in-flight requests
 * - Error handling with user-friendly messages
 *
 * Built using createAgentHook factory for consistency with other agent hooks.
 */

import {
  createAgentHook,
  type BaseAgentHookResult,
  type PayloadContext,
} from "./createAgentHook";
import {
  sendAgentMessageStreaming,
  AgentApiError,
  type AgentRequestPayload,
  type AgentStreamOptions,
} from "../services/ai";

/**
 * Options for the useChatAgent hook
 */
export interface UseChatAgentOptions {
  /** Enable the hook (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the useChatAgent hook
 */
export type UseChatAgentResult = BaseAgentHookResult;

/**
 * Build the payload for the agent API
 */
function buildChatPayload(context: PayloadContext): AgentRequestPayload {
  return {
    messages: context.messages,
    projectId: context.projectId,
    mentions: context.mentions,
  };
}

/**
 * Hook for RAG-powered chat functionality
 *
 * Uses createAgentHook factory with ChatAgent-specific configuration.
 */
export const useChatAgent = createAgentHook<
  AgentRequestPayload,
  AgentStreamOptions
>({
  name: "ChatAgent",
  errorConfig: {
    isApiError: (error): error is AgentApiError => error instanceof AgentApiError,
    getErrorCode: (error) =>
      error instanceof AgentApiError ? error.agentCode : undefined,
    errorPrefix: "Chat error",
  },
  sendStreaming: sendAgentMessageStreaming,
  buildPayload: buildChatPayload,
});
