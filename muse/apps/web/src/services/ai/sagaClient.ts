/**
 * Saga AI Client
 *
 * Unified client for the ai-saga endpoint.
 * Supports:
 * - Streaming chat with tool proposals
 * - Non-streaming tool execution
 */

import { ApiError, type ApiErrorCode } from "../api-client";
import type { ChatContext, ChatMention } from "../../stores";
import type {
  ToolName,
  GenesisWorldArgs,
  GenesisWorldResult,
  DetectEntitiesArgs,
  DetectEntitiesResult,
  CheckConsistencyArgs,
  CheckConsistencyResult,
  GenerateTemplateArgs,
  GenerateTemplateResult,
} from "@mythos/agent-protocol";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

// =============================================================================
// Types
// =============================================================================

export type SagaApiErrorCode = ApiErrorCode | "TOOL_ERROR" | "TOOL_EXECUTION_ERROR";

export class SagaApiError extends ApiError {
  readonly sagaCode: SagaApiErrorCode;

  constructor(message: string, statusCode?: number, code?: SagaApiErrorCode) {
    super(message, (code ?? "UNKNOWN_ERROR") as ApiErrorCode, statusCode);
    this.name = "SagaApiError";
    this.sagaCode = code ?? "UNKNOWN_ERROR";
  }
}

export type SagaMode = "onboarding" | "creation" | "editing" | "analysis";

export interface EditorContext {
  documentTitle?: string;
  selectionText?: string;
}

export interface SagaMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface SagaChatPayload {
  messages: SagaMessagePayload[];
  projectId: string;
  mentions?: ChatMention[];
  editorContext?: EditorContext;
  mode?: SagaMode;
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: ToolName;
  args: unknown;
}

export type SagaStreamEventType =
  | "context"
  | "delta"
  | "tool"
  | "progress"
  | "done"
  | "error";

export interface SagaStreamEvent {
  type: SagaStreamEventType;
  content?: string;
  data?: ChatContext;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  message?: string;
  progress?: { pct?: number; stage?: string };
}

export interface SagaStreamOptions {
  signal?: AbortSignal;
  apiKey?: string;
  onContext?: (context: ChatContext) => void;
  onDelta?: (delta: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  onProgress?: (toolCallId: string, progress: { pct?: number; stage?: string }) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface ExecuteToolOptions {
  signal?: AbortSignal;
  apiKey?: string;
}

// =============================================================================
// SSE Timeout Helper
// =============================================================================

const SSE_READ_TIMEOUT_MS = 60000; // 60s for saga (longer operations)

async function readWithTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  timeoutMs: number = SSE_READ_TIMEOUT_MS
) {
  return Promise.race([
    reader.read(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SSE read timeout")), timeoutMs)
    ),
  ]);
}

// =============================================================================
// SSE Parsing
// =============================================================================

function parseSSELine(line: string): SagaStreamEvent | null {
  if (!line.startsWith("data: ")) {
    return null;
  }

  const jsonStr = line.slice(6).trim();
  if (!jsonStr || jsonStr === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(jsonStr) as SagaStreamEvent;
  } catch {
    console.warn("[sagaClient] Failed to parse SSE:", jsonStr);
    return null;
  }
}

// =============================================================================
// Streaming Chat API
// =============================================================================

/**
 * Send a chat message to Saga AI with streaming response.
 * Handles tool proposals, text deltas, and progress updates.
 */
export async function sendSagaChatStreaming(
  payload: SagaChatPayload,
  opts?: SagaStreamOptions
): Promise<void> {
  const { signal, apiKey, onContext, onDelta, onTool, onProgress, onDone, onError } =
    opts ?? {};

  const url = `${SUPABASE_URL}/functions/v1/ai-saga`;

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
      body: JSON.stringify({ kind: "chat", ...payload, stream: true }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Saga request failed: ${response.status}`;
      let errorCode: SagaApiErrorCode = "UNKNOWN_ERROR";

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
        errorCode = errorJson.code || errorCode;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new SagaApiError(errorMessage, response.status, errorCode);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new SagaApiError("No response body", 500);
    }

    const decoder = new TextDecoder();
    const chunks: string[] = [];

    while (true) {
      const { done, value } = await readWithTimeout(reader);
      if (done) break;

      chunks.push(decoder.decode(value, { stream: true }));
      const buffer = chunks.join("");
      const lines = buffer.split("\n");
      const remainder = lines.pop() ?? "";
      chunks.length = 0;
      if (remainder) chunks.push(remainder);

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
                toolName: event.toolName as ToolName,
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
            onError?.(new SagaApiError(event.message ?? "Unknown error"));
            break;
        }
      }
    }

    // Process remaining buffer
    const remainingBuffer = chunks.join("");
    if (remainingBuffer.trim()) {
      const event = parseSSELine(remainingBuffer);
      if (event?.type === "done") {
        onDone?.();
      } else if (event?.type === "error") {
        onError?.(new SagaApiError(event.message ?? "Unknown error"));
      }
    }
  } catch (error) {
    if (error instanceof SagaApiError) {
      onError?.(error);
    } else if (error instanceof Error) {
      if (error.name === "AbortError") {
        return;
      }
      onError?.(new SagaApiError(error.message));
    } else {
      onError?.(new SagaApiError("Unknown error occurred"));
    }
  }
}

// =============================================================================
// Tool Execution API (Non-Streaming)
// =============================================================================

interface ExecuteToolResponse<T> {
  toolName: string;
  result: T;
}

/**
 * Execute a Saga tool directly (non-streaming).
 * Used after user accepts a tool proposal.
 */
async function executeSagaTool<T>(
  toolName: string,
  input: unknown,
  opts?: ExecuteToolOptions
): Promise<T> {
  const { signal, apiKey } = opts ?? {};

  const url = `${SUPABASE_URL}/functions/v1/ai-saga`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["x-openrouter-key"] = apiKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "execute_tool", toolName, input }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Tool execution failed: ${response.status}`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new SagaApiError(errorMessage, response.status, "TOOL_EXECUTION_ERROR");
  }

  const data = (await response.json()) as ExecuteToolResponse<T>;
  return data.result;
}

// =============================================================================
// Typed Tool Execution Wrappers
// =============================================================================

/**
 * Execute genesis_world to generate a complete world scaffold.
 */
export async function executeGenesisWorld(
  input: GenesisWorldArgs,
  opts?: ExecuteToolOptions
): Promise<GenesisWorldResult> {
  return executeSagaTool<GenesisWorldResult>("genesis_world", input, opts);
}

/**
 * Execute detect_entities to extract entities from text.
 */
export async function executeDetectEntities(
  input: DetectEntitiesArgs & { text: string },
  opts?: ExecuteToolOptions
): Promise<DetectEntitiesResult> {
  return executeSagaTool<DetectEntitiesResult>("detect_entities", input, opts);
}

/**
 * Execute check_consistency to find contradictions and plot holes.
 */
export async function executeCheckConsistency(
  input: CheckConsistencyArgs & { text: string; entities?: unknown[] },
  opts?: ExecuteToolOptions
): Promise<CheckConsistencyResult> {
  return executeSagaTool<CheckConsistencyResult>("check_consistency", input, opts);
}

/**
 * Execute generate_template to create a custom project template.
 */
export async function executeGenerateTemplate(
  input: GenerateTemplateArgs,
  opts?: ExecuteToolOptions
): Promise<GenerateTemplateResult> {
  return executeSagaTool<GenerateTemplateResult>("generate_template", input, opts);
}
