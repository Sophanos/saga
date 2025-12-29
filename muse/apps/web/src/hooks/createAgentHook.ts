/**
 * createAgentHook - Factory for creating agent chat hooks
 *
 * Reduces duplication between useChatAgent and useSagaAgent by extracting
 * common patterns:
 * - generateMessageId() utility
 * - getErrorMessage() utility
 * - AbortController handling
 * - stopStreaming() / clearChat() callbacks
 * - Common state management (messages, streaming, errors)
 * - Cleanup on unmount
 *
 * Each agent hook configures:
 * - API endpoint / streaming function
 * - Error class handling
 * - Payload building
 * - Optional extra callbacks (onProgress, etc.)
 */

import { useCallback, useRef, useEffect } from "react";
import {
  useMythosStore,
  type ChatMessage,
  type ChatMention,
  type ChatContext,
} from "../stores";
import type { ToolName } from "@mythos/agent-protocol";

// =============================================================================
// Shared Utilities
// =============================================================================

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Configuration for getErrorMessage utility
 */
export interface ErrorMessageConfig {
  /** Function to check if error is from the API */
  isApiError: (error: unknown) => boolean;
  /** Function to get error code from API error */
  getErrorCode: (error: unknown) => string | undefined;
  /** Prefix for generic error messages (e.g., "Chat error" or "Saga error") */
  errorPrefix: string;
  /** Map of error codes to user-friendly messages */
  errorCodeMessages?: Record<string, string>;
}

/**
 * Default error code messages shared across all agents
 */
const DEFAULT_ERROR_CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Please configure your API key in settings.",
  RATE_LIMITED: "Too many requests. Please wait a moment.",
  ABORTED: "", // Don't show error for aborted requests
};

/**
 * Create a getErrorMessage function with the given configuration
 */
export function createGetErrorMessage(config: ErrorMessageConfig) {
  const codeMessages = {
    ...DEFAULT_ERROR_CODE_MESSAGES,
    ...config.errorCodeMessages,
  };

  return function getErrorMessage(error: unknown): string {
    if (config.isApiError(error)) {
      const code = config.getErrorCode(error);
      if (code && code in codeMessages) {
        return codeMessages[code];
      }
      // For VALIDATION_ERROR and others, return the message directly
      if (error instanceof Error) {
        return `${config.errorPrefix}: ${error.message}`;
      }
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return ""; // Don't show error for aborted requests
      }
      return `${config.errorPrefix}: ${error.message}`;
    }

    return "An unexpected error occurred.";
  };
}

// =============================================================================
// Factory Types
// =============================================================================

/**
 * Tool call result from streaming API
 */
export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/**
 * Base message payload for API calls
 */
export interface BaseMessagePayload {
  role: "user" | "assistant";
  content: string;
}

/**
 * Base streaming options that all agents support
 */
export interface BaseStreamOptions {
  signal?: AbortSignal;
  onContext?: (context: ChatContext) => void;
  onDelta?: (delta: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Configuration for the agent hook factory
 */
export interface AgentHookConfig<
  TPayload extends object,
  TOptions extends BaseStreamOptions,
  TExtra = object
> {
  /**
   * Name of the agent for debugging
   */
  name: string;

  /**
   * Error handling configuration
   */
  errorConfig: ErrorMessageConfig;

  /**
   * The streaming API function to call
   */
  sendStreaming: (payload: TPayload, options?: TOptions) => Promise<void>;

  /**
   * Build the API payload from hook context
   */
  buildPayload: (context: PayloadContext, extra: TExtra) => TPayload;

  /**
   * Build extra streaming options beyond the base ones
   */
  buildStreamOptions?: (
    context: StreamOptionsContext
  ) => Partial<TOptions>;

  /**
   * Initialize extra state/refs for the hook
   * Returns object to merge with base hook return
   */
  useExtraState?: () => {
    extra: TExtra;
    extraReturn: Record<string, unknown>;
    extraDeps: unknown[];
  };
}

/**
 * Context passed to buildPayload
 */
export interface PayloadContext {
  messages: BaseMessagePayload[];
  projectId: string;
  mentions?: ChatMention[];
}

/**
 * Context passed to buildStreamOptions
 */
export interface StreamOptionsContext {
  assistantMessageId: string;
  abortSignal: AbortSignal;
}

/**
 * Base result type for agent hooks
 */
export interface BaseAgentHookResult {
  sendMessage: (content: string, mentions?: ChatMention[]) => Promise<void>;
  stopStreaming: () => void;
  clearChat: () => void;
  isStreaming: boolean;
  error: string | null;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an agent hook with the given configuration.
 *
 * @example
 * ```ts
 * const useChatAgent = createAgentHook({
 *   name: "ChatAgent",
 *   errorConfig: { ... },
 *   sendStreaming: sendAgentMessageStreaming,
 *   buildPayload: (ctx) => ({ messages: ctx.messages, projectId: ctx.projectId }),
 * });
 * ```
 */
export function createAgentHook<
  TPayload extends object,
  TOptions extends BaseStreamOptions,
  TExtra = object,
  TExtraReturn extends Record<string, unknown> = Record<string, never>
>(
  config: AgentHookConfig<TPayload, TOptions, TExtra>
): (options?: { enabled?: boolean }) => BaseAgentHookResult & TExtraReturn {
  const getErrorMessage = createGetErrorMessage(config.errorConfig);

  return function useAgentHook(options?: { enabled?: boolean }) {
    const { enabled = true } = options ?? {};

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

    // Ref for abort controller
    const abortControllerRef = useRef<AbortController | null>(null);

    // Get extra state from hook config
    const extraState = config.useExtraState?.() ?? {
      extra: {} as TExtra,
      extraReturn: {} as TExtraReturn,
      extraDeps: [],
    };

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
          const apiMessages: BaseMessagePayload[] = currentMessages
            .filter(
              (m) => m.role !== "system" && !m.isStreaming && m.kind !== "tool"
            )
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));

          // Build the payload using config function
          const payload = config.buildPayload(
            {
              messages: apiMessages,
              projectId,
              mentions,
            },
            extraState.extra
          );

          // Build base stream options
          const baseOptions: BaseStreamOptions = {
            signal: abortController.signal,
            onContext: (context: ChatContext) => {
              setChatContext(context);
            },
            onDelta: (delta: string) => {
              appendToChatMessage(assistantMessageId, delta);
            },
            onTool: (tool: ToolCallResult) => {
              // Create a tool message with the stable toolCallId from the LLM
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
                  status: "proposed",
                },
              };
              addChatMessage(toolMessage);
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
              // Read current content from store to avoid stale closure
              const currentMsgs = useMythosStore.getState().chat.messages;
              const currentMessage = currentMsgs.find(
                (m) => m.id === assistantMessageId
              );
              updateChatMessage(assistantMessageId, {
                isStreaming: false,
                content:
                  currentMessage?.content || "Sorry, I encountered an error.",
              });
              setChatStreaming(false);
            },
          };

          // Build extra stream options if configured
          const extraOptions = config.buildStreamOptions?.({
            assistantMessageId,
            abortSignal: abortController.signal,
          });

          await config.sendStreaming(
            payload,
            { ...baseOptions, ...extraOptions } as TOptions
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
        addChatMessage,
        updateChatMessage,
        appendToChatMessage,
        setChatStreaming,
        setChatError,
        setChatContext,
        ...extraState.extraDeps,
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

    // Build the return object
    const baseResult: BaseAgentHookResult = {
      sendMessage,
      stopStreaming,
      clearChat,
      isStreaming,
      error,
    };

    return {
      ...baseResult,
      ...extraState.extraReturn,
    } as BaseAgentHookResult & TExtraReturn;
  };
}
