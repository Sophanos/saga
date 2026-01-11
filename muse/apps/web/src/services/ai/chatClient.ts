/**
 * Chat API Client - Calls Convex HTTP action /api/ai/chat
 *
 * Provides RAG-powered chat with streaming support.
 * Handles SSE streaming responses for real-time text generation.
 */

import { ApiError, type ApiErrorCode } from "../api-client";
import { getAIEndpoint } from "../config";
import { authClient } from "../../lib/auth";
import type { ChatContext, ChatMention } from "../../stores";

/**
 * Chat message for API
 */
export interface ChatMessagePayload {
  role: "user" | "assistant";
  content: string;
}

/**
 * Chat request payload
 */
export interface ChatRequestPayload {
  messages: ChatMessagePayload[];
  projectId: string;
  mentions?: ChatMention[];
  stream?: boolean;
}

/**
 * Non-streaming response
 */
export interface ChatResponsePayload {
  content: string;
  context: ChatContext;
}

/**
 * Streaming event types
 */
export type ChatStreamEventType = "context" | "delta" | "tool" | "done" | "error";

/**
 * Tool call result from SSE stream
 */
export interface ToolCallResult {
  toolName: string;
  args: unknown;
}

/**
 * Streaming event
 */
export interface ChatStreamEvent {
  type: ChatStreamEventType;
  content?: string;
  data?: ChatContext;
  message?: string;
  toolName?: string;
  args?: unknown;
}

/**
 * Chat request options
 */
export interface ChatRequestOptions {
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
}

/**
 * Chat streaming options
 */
export interface ChatStreamOptions extends ChatRequestOptions {
  onContext?: (context: ChatContext) => void;
  onDelta?: (content: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Chat-specific API error
 */
export class ChatApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    code?: ApiErrorCode
  ) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "ChatApiError";
  }
}

/**
 * Parse SSE line into event
 */
function parseSSELine(line: string): ChatStreamEvent | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  try {
    const json = line.slice(6); // Remove "data: " prefix
    return JSON.parse(json) as ChatStreamEvent;
  } catch {
    console.warn("[chatClient] Failed to parse SSE line:", line);
    return null;
  }
}

async function resolveAuthHeader(authToken?: string): Promise<string | null> {
  if (authToken) {
    return authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
  }

  try {
    const token = await authClient.$fetch("/api/auth/convex-token", {
      method: "GET",
    });
    return token?.data?.token ? `Bearer ${token.data.token}` : null;
  } catch {
    return null;
  }
}

/**
 * Send chat message with streaming response
 *
 * @param payload - Chat request parameters
 * @param opts - Streaming options with callbacks
 * @returns Promise that resolves when streaming is complete
 */
export async function sendChatMessageStreaming(
  payload: ChatRequestPayload,
  opts?: ChatStreamOptions
): Promise<void> {
  const { signal, apiKey, authToken, onContext, onDelta, onTool, onDone, onError } = opts ?? {};

  const url = getAIEndpoint("/ai/chat");
  const resolvedAuthHeader = await resolveAuthHeader(authToken);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
        ...(resolvedAuthHeader && { Authorization: resolvedAuthHeader }),
      },
      body: JSON.stringify({
        ...payload,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `Chat request failed: ${response.status}`;
      let errorCode: ApiErrorCode = "UNKNOWN_ERROR";

      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
        if (errorData.error?.code) {
          errorCode = errorData.error.code as ApiErrorCode;
        }
      } catch {
        // Use default error message
      }

      throw new ChatApiError(errorMessage, response.status, errorCode);
    }

    if (!response.body) {
      throw new ChatApiError("No response body", 500, "SERVER_ERROR");
    }

    // Process SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const event = parseSSELine(trimmedLine);
        if (!event) continue;

        switch (event.type) {
          case "context":
            if (event.data && onContext) {
              onContext(event.data);
            }
            break;

          case "delta":
            if (event.content && onDelta) {
              onDelta(event.content);
            }
            break;

          case "tool":
            if (event.toolName && onTool) {
              onTool({
                toolName: event.toolName,
                args: event.args,
              });
            }
            break;

          case "done":
            if (onDone) {
              onDone();
            }
            break;

          case "error":
            if (onError) {
              onError(new ChatApiError(event.message || "Unknown error"));
            }
            break;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const event = parseSSELine(buffer.trim());
      if (event?.type === "done" && onDone) {
        onDone();
      }
    }
  } catch (error) {
    if (error instanceof ChatApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ChatApiError("Request aborted", undefined, "ABORTED");
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ChatApiError(message, undefined, "UNKNOWN_ERROR");
  }
}

/**
 * Send chat message without streaming
 *
 * @param payload - Chat request parameters
 * @param opts - Request options
 * @returns Chat response with content and context
 */
export async function sendChatMessage(
  payload: ChatRequestPayload,
  opts?: ChatRequestOptions
): Promise<ChatResponsePayload> {
  const { signal, apiKey, authToken } = opts ?? {};

  const url = getAIEndpoint("/ai/chat");
  const resolvedAuthHeader = await resolveAuthHeader(authToken);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
        ...(resolvedAuthHeader && { Authorization: resolvedAuthHeader }),
      },
      body: JSON.stringify({
        ...payload,
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `Chat request failed: ${response.status}`;
      let errorCode: ApiErrorCode = "UNKNOWN_ERROR";

      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
        if (errorData.error?.code) {
          errorCode = errorData.error.code as ApiErrorCode;
        }
      } catch {
        // Use default error message
      }

      throw new ChatApiError(errorMessage, response.status, errorCode);
    }

    return (await response.json()) as ChatResponsePayload;
  } catch (error) {
    if (error instanceof ChatApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ChatApiError("Request aborted", undefined, "ABORTED");
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ChatApiError(message, undefined, "UNKNOWN_ERROR");
  }
}
