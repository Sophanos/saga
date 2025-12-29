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
 */

import { useCallback, useRef, useEffect } from "react";
import {
  useMythosStore,
  type ChatMessage,
  type ChatMention,
  type ChatContext,
} from "../stores";
import {
  sendChatMessageStreaming,
  ChatApiError,
  type ChatMessagePayload,
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
export interface UseChatAgentResult {
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
  if (error instanceof ChatApiError) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return "Please configure your API key in settings.";
      case "RATE_LIMITED":
        return "Too many messages. Please wait a moment.";
      case "ABORTED":
        return ""; // Don't show error for aborted requests
      case "VALIDATION_ERROR":
        return error.message;
      default:
        return `Chat error: ${error.message}`;
    }
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return ""; // Don't show error for aborted requests
    }
    return `Chat error: ${error.message}`;
  }

  return "An unexpected error occurred.";
}

/**
 * Hook for RAG-powered chat functionality
 */
export function useChatAgent(options?: UseChatAgentOptions): UseChatAgentResult {
  const { enabled = true } = options ?? {};

  // Store state and actions
  const currentProject = useMythosStore((s) => s.project.currentProject);
  const messages = useMythosStore((s) => s.chat.messages);
  const isStreaming = useMythosStore((s) => s.chat.isStreaming);
  const error = useMythosStore((s) => s.chat.error);

  const addChatMessage = useMythosStore((s) => s.addChatMessage);
  const updateChatMessage = useMythosStore((s) => s.updateChatMessage);
  const appendToChatMessage = useMythosStore((s) => s.appendToChatMessage);
  const setChatStreaming = useMythosStore((s) => s.setChatStreaming);
  const setChatError = useMythosStore((s) => s.setChatError);
  const setChatContext = useMythosStore((s) => s.setChatContext);
  const startNewConversation = useMythosStore((s) => s.startNewConversation);

  // Ref for abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

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

      try {
        // Build messages array for API (excluding the placeholder)
        const apiMessages: ChatMessagePayload[] = messages
          .filter((m) => m.role !== "system" && !m.isStreaming)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Add the new user message
        apiMessages.push({
          role: "user",
          content: content.trim(),
        });

        await sendChatMessageStreaming(
          {
            messages: apiMessages,
            projectId,
            mentions,
          },
          {
            signal: abortController.signal,
            onContext: (context: ChatContext) => {
              setChatContext(context);
            },
            onDelta: (delta: string) => {
              appendToChatMessage(assistantMessageId, delta);
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
          }
        );
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
      messages,
      addChatMessage,
      updateChatMessage,
      appendToChatMessage,
      setChatStreaming,
      setChatError,
      setChatContext,
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
  };
}
