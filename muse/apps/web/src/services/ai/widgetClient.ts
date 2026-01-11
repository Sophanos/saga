import { ApiError, type ApiErrorCode } from "../api-client";
import { getAIEndpoint } from "../config";
import { getConvexToken } from "../../lib/tokenCache";
import type { WidgetInvokeRequest } from "@mythos/agent-protocol";

export type WidgetStreamEventType = "context" | "delta" | "done" | "error";

export interface WidgetStreamEvent {
  type: WidgetStreamEventType;
  content?: string;
  data?: unknown;
  message?: string;
}

export interface WidgetStreamOptions {
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
  onContext?: (data: unknown) => void;
  onDelta?: (content: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export class WidgetApiError extends ApiError {
  constructor(message: string, statusCode?: number, code?: ApiErrorCode) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "WidgetApiError";
  }
}

function parseSSELine(line: string): WidgetStreamEvent | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  try {
    const json = line.slice(6);
    return JSON.parse(json) as WidgetStreamEvent;
  } catch {
    console.warn("[widgetClient] Failed to parse SSE line:", line);
    return null;
  }
}

async function resolveAuthHeader(authToken?: string): Promise<string | null> {
  if (authToken) {
    return authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
  }
  const token = await getConvexToken();
  return token ? `Bearer ${token}` : null;
}

export async function sendWidgetRunStreaming(
  payload: WidgetInvokeRequest,
  opts?: WidgetStreamOptions
): Promise<void> {
  const { signal, apiKey, authToken, onContext, onDelta, onDone, onError } = opts ?? {};

  const url = getAIEndpoint("/ai/widgets");
  const resolvedAuthHeader = await resolveAuthHeader(authToken);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
        ...(resolvedAuthHeader && { Authorization: resolvedAuthHeader }),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `Widget request failed: ${response.status}`;
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
        // Ignore JSON parse failures
      }

      throw new WidgetApiError(errorMessage, response.status, errorCode);
    }

    if (!response.body) {
      throw new WidgetApiError("No response body", 500, "SERVER_ERROR");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith(":")) continue;

        const event = parseSSELine(line);
        if (!event) continue;

        switch (event.type) {
          case "context":
            onContext?.(event.data);
            break;
          case "delta":
            if (event.content) {
              onDelta?.(event.content);
            }
            break;
          case "error":
            onError?.(new Error(event.message ?? "Widget error"));
            break;
          case "done":
            onDone?.();
            break;
        }
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown widget error");
    onError?.(err);
  }
}
