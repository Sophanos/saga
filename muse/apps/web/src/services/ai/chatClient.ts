/**
 * Chat API Client - Calls Supabase edge function /functions/v1/ai-chat
 *
 * Provides RAG-powered chat with streaming support.
 * Handles SSE streaming responses for real-time text generation.
 */

import { ApiError, type ApiErrorCode } from "../api-client";
import type { ChatContext, ChatMention } from "../../stores";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

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
export type ChatStreamEventType = "context" | "delta" | "done" | "error";

/**
 * Streaming event
 */
export interface ChatStreamEvent {
  type: ChatStreamEventType;
  content?: string;
  data?: ChatContext;
  message?: string;
}

/**
 * Chat request options
 */
export interface ChatRequestOptions {
  signal?: AbortSignal;
  apiKey?: string;
}

/**
 * Chat streaming options
 */
export interface ChatStreamOptions extends ChatRequestOptions {
  onContext?: (context: ChatContext) => void;
  onDelta?: (content: string) => void;
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
  const { signal, apiKey, onContext, onDelta, onDone, onError } = opts ?? {};

  if (!SUPABASE_URL) {
    throw new ChatApiError(
      "VITE_SUPABASE_URL not configured",
      500,
      "CONFIGURATION_ERROR"
    );
  }

  const url = `${SUPABASE_URL}/functions/v1/ai-chat`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
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
  const { signal, apiKey } = opts ?? {};

  if (!SUPABASE_URL) {
    throw new ChatApiError(
      "VITE_SUPABASE_URL not configured",
      500,
      "CONFIGURATION_ERROR"
    );
  }

  const url = `${SUPABASE_URL}/functions/v1/ai-chat`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
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
