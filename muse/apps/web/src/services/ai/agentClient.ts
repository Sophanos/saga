import { ApiError, type ApiErrorCode } from "../api-client";
import type { ChatContext, ChatMention } from "../../stores";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

// =============================================================================
// Types
// =============================================================================

export type AgentApiErrorCode = ApiErrorCode | "TOOL_ERROR";

export class AgentApiError extends ApiError {
  readonly agentCode: AgentApiErrorCode;

  constructor(
    message: string,
    statusCode?: number,
    code?: AgentApiErrorCode
  ) {
    // Cast to base ApiErrorCode for parent constructor
    super(message, (code ?? "UNKNOWN_ERROR") as ApiErrorCode, statusCode);
    this.name = "AgentApiError";
    this.agentCode = code ?? "UNKNOWN_ERROR";
  }
}

export interface EditorContext {
  documentTitle?: string;
  selectionText?: string;
  selectionContext?: string;
}

export interface AgentMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface AgentRequestPayload {
  messages: AgentMessagePayload[];
  projectId: string;
  mentions?: ChatMention[];
  editorContext?: EditorContext;
  stream?: boolean;
}

/**
 * Tool call result with stable ID from the LLM.
 */
export interface ToolCallResult {
  /** Stable ID from the LLM for tracking the tool call lifecycle */
  toolCallId: string;
  /** Name of the tool being called */
  toolName: string;
  /** Tool-specific arguments */
  args: unknown;
}

export type AgentStreamEventType = "context" | "delta" | "tool" | "progress" | "done" | "error";

export interface AgentStreamEvent {
  type: AgentStreamEventType;
  content?: string;
  data?: ChatContext;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  message?: string;
  progress?: { pct?: number; stage?: string };
}

export interface AgentStreamOptions {
  signal?: AbortSignal;
  apiKey?: string;
  onContext?: (context: ChatContext) => void;
  onDelta?: (delta: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  onProgress?: (toolCallId: string, progress: { pct?: number; stage?: string }) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// SSE Timeout Helper
// =============================================================================

const SSE_READ_TIMEOUT_MS = 30000;

async function readWithTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  timeoutMs: number = SSE_READ_TIMEOUT_MS
) {
  return Promise.race([
    reader.read(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SSE read timeout')), timeoutMs)
    ),
  ]);
}

// =============================================================================
// SSE Parsing
// =============================================================================

function parseSSELine(line: string): AgentStreamEvent | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  const jsonStr = line.slice(6).trim();
  if (!jsonStr || jsonStr === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(jsonStr) as AgentStreamEvent;
  } catch {
    console.warn("[agentClient] Failed to parse SSE:", jsonStr);
    return null;
  }
}

// =============================================================================
// Streaming API
// =============================================================================

export async function sendAgentMessageStreaming(
  payload: AgentRequestPayload,
  opts?: AgentStreamOptions
): Promise<void> {
  const { signal, apiKey, onContext, onDelta, onTool, onProgress, onDone, onError } = opts ?? {};

  const url = `${SUPABASE_URL}/functions/v1/ai-agent`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["x-openrouter-key"] = apiKey;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, stream: true }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Agent request failed: ${response.status}`;
      let errorCode: AgentApiErrorCode = "UNKNOWN_ERROR";

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
        errorCode = errorJson.code || errorCode;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new AgentApiError(errorMessage, response.status, errorCode);
    }

    // Read SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new AgentApiError("No response body", 500);
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await readWithTimeout(reader);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseSSELine(line);
        if (!event) continue;

        switch (event.type) {
          case "context":
            onContext?.(event.data as ChatContext);
            break;

          case "delta":
            if (event.content) {
              onDelta?.(event.content);
            }
            break;

          case "tool":
            if (event.toolName && event.toolCallId) {
              onTool?.({
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args,
              });
            }
            break;

          case "progress":
            if (event.toolCallId && event.progress) {
              onProgress?.(event.toolCallId, event.progress);
            }
            break;

          case "done":
            onDone?.();
            break;

          case "error":
            onError?.(new AgentApiError(event.message ?? "Unknown error"));
            break;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const event = parseSSELine(buffer);
      if (event) {
        if (event.type === "done") {
          onDone?.();
        } else if (event.type === "error") {
          onError?.(new AgentApiError(event.message ?? "Unknown error"));
        }
      }
    }
  } catch (error) {
    if (error instanceof AgentApiError) {
      onError?.(error);
    } else if (error instanceof Error) {
      if (error.name === "AbortError") {
        // Silently handle abort
        return;
      }
      onError?.(new AgentApiError(error.message));
    } else {
      onError?.(new AgentApiError("Unknown error occurred"));
    }
  }
}
