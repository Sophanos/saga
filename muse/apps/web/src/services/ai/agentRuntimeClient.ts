/**
 * Agent Runtime Client
 *
 * Unified client for the ai-saga endpoint.
 * Supports:
 * - Streaming chat with tool proposals
 * - Non-streaming tool execution
 */

import { ApiError, type ApiErrorCode } from "../api-client";
import { getAnonHeaders } from "../anonymousSession";
import { API_TIMEOUTS, RETRY_CONFIG, getAIEndpoint } from "../config";
import { authClient } from "../../lib/auth";
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
  ClarityCheckArgs,
  ClarityCheckResult,
  PolicyCheckArgs,
  PolicyCheckResult,
  CheckLogicArgs,
  CheckLogicResult,
  NameGeneratorArgs,
  NameGeneratorResult,
  SagaMode,
  EditorContext,
  AgentStreamEventType,
  ToolApprovalType,
  ToolApprovalDanger,
} from "@mythos/agent-protocol";
import type { UnifiedContextHints } from "@mythos/context";

async function resolveAuthHeader(authToken?: string): Promise<string | null> {
  if (authToken) {
    return authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
  }

  try {
    const response = await authClient.$fetch("/api/auth/convex-token", {
      method: "GET",
    });
    const tokenData = response?.data as { token?: string } | undefined;
    return tokenData?.token ? `Bearer ${tokenData.token}` : null;
  } catch {
    return null;
  }
}

// =============================================================================
// Retry Helper (for non-streaming requests)
// =============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = RETRY_CONFIG.MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Retry on rate limit or server errors
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.BASE_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt),
            RETRY_CONFIG.MAX_DELAY_MS
          );
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.min(
        RETRY_CONFIG.BASE_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt),
        RETRY_CONFIG.MAX_DELAY_MS
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

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

// Re-export types from agent-protocol for backwards compatibility
export type { SagaMode, EditorContext } from "@mythos/agent-protocol";

export interface SagaMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface SagaChatPayload {
  prompt: string;
  projectId: string;
  mentions?: ChatMention[];
  editorContext?: EditorContext;
  contextHints?: UnifiedContextHints;
  mode?: SagaMode;
  /** Agent thread ID for session continuity */
  threadId?: string;
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: ToolName;
  args: unknown;
  promptMessageId?: string;
}

/** Alias for AgentStreamEventType - same event types used for Saga streaming */
export type SagaStreamEventType = AgentStreamEventType;

export interface SagaStreamEvent {
  type: SagaStreamEventType;
  content?: string;
  data?: ChatContext;
  toolCallId?: string;
  approvalId?: string;
  toolName?: string;
  args?: unknown;
  approvalType?: ToolApprovalType;
  danger?: ToolApprovalDanger;
  suggestionId?: string;
  promptMessageId?: string;
  message?: string;
  progress?: { pct?: number; stage?: string };
}

/**
 * Result of a tool that requires approval (AI SDK 6 needsApproval)
 */
export interface ToolApprovalRequest {
  approvalId: string;
  toolCallId?: string;
  toolName: ToolName;
  args: unknown;
  approvalType: ToolApprovalType;
  danger?: ToolApprovalDanger;
  suggestionId?: string;
  promptMessageId?: string;
}

export interface SagaStreamOptions {
  signal?: AbortSignal;
  /** OpenRouter API key for BYOK mode */
  apiKey?: string;
  /** Convex auth token for per-user memory/profile */
  authToken?: string;
  onContext?: (context: ChatContext) => void;
  onDelta?: (delta: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  /** AI SDK 6: Called when a tool needs approval before execution */
  onToolApprovalRequest?: (request: ToolApprovalRequest) => void;
  onProgress?: (toolCallId: string, progress: { pct?: number; stage?: string }) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface ExecuteToolOptions {
  /** Project ID required by the Saga endpoint */
  projectId: string;
  signal?: AbortSignal;
  /** OpenRouter API key for BYOK mode */
  apiKey?: string;
  /** Convex auth token for per-user memory/profile */
  authToken?: string;
}

// =============================================================================
// Timeout Helpers
// =============================================================================

/**
 * Create an AbortSignal that triggers on timeout OR user abort.
 * Combines AbortSignal.timeout() with an optional user-provided signal.
 */
function createTimeoutSignal(timeoutMs: number, userSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!userSignal) return timeoutSignal;
  // Combine signals - abort when either fires
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  timeoutSignal.addEventListener("abort", onAbort);
  userSignal.addEventListener("abort", onAbort);
  return controller.signal;
}

function waitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = API_TIMEOUTS.SSE_READ_MS,
  timeoutMessage: string = "SSE read timeout"
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// =============================================================================
// SSE Parsing
// =============================================================================

const MAX_CONSECUTIVE_SSE_TIMEOUTS = 2;

function parseSSEPayload(payload: string): SagaStreamEvent | null {
  const jsonStr = payload.trim();
  if (!jsonStr || jsonStr === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(jsonStr) as SagaStreamEvent;
  } catch {
    console.warn("[agentRuntimeClient] Failed to parse SSE:", jsonStr);
    return null;
  }
}

function handleSSELine(line: string, dataLines: string[]): SagaStreamEvent | null {
  const normalized = line.replace(/\r$/, "");

  if (!normalized) {
    if (dataLines.length === 0) return null;
    const payload = dataLines.join("\n");
    dataLines.length = 0;
    return parseSSEPayload(payload);
  }

  if (normalized.startsWith(":")) {
    return null;
  }

  if (normalized.startsWith("data:")) {
    const data = normalized.slice(5);
    dataLines.push(data.startsWith(" ") ? data.slice(1) : data);
  }

  return null;
}

function flushSSEDataLines(dataLines: string[]): SagaStreamEvent | null {
  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n");
  dataLines.length = 0;
  return parseSSEPayload(payload);
}

/**
 * Handle a single SSE event by dispatching to the appropriate callback.
 * Shared between sendSagaChatStreaming and sendToolResultStreaming.
 */
function handleSSEEvent(
  event: SagaStreamEvent,
  callbacks: Pick<
    SagaStreamOptions,
    "onContext" | "onDelta" | "onTool" | "onToolApprovalRequest" | "onProgress" | "onDone" | "onError"
  >
): boolean {
  const { onContext, onDelta, onTool, onToolApprovalRequest, onProgress, onDone, onError } = callbacks;

  switch (event.type) {
    case "context":
      onContext?.(event.data as ChatContext);
      return false;

    case "delta":
      if (event.content) {
        onDelta?.(event.content);
      }
      return false;

    case "tool":
      if (event.toolName && event.toolCallId) {
        onTool?.({
          toolCallId: event.toolCallId,
          toolName: event.toolName as ToolName,
          args: event.args,
          promptMessageId: event.promptMessageId,
        });
      }
      return false;

    case "tool-approval-request":
      if (event.toolName && (event.approvalId || event.toolCallId)) {
        const approvalId = event.approvalId ?? event.toolCallId;
        onToolApprovalRequest?.({
          approvalId: approvalId as string,
          toolCallId: event.toolCallId,
          toolName: event.toolName as ToolName,
          args: event.args,
          approvalType: event.approvalType ?? "execution",
          danger: event.danger,
          suggestionId: event.suggestionId,
          promptMessageId: event.promptMessageId,
        });
      }
      return false;

    case "progress":
      if (event.toolCallId && event.progress) {
        onProgress?.(event.toolCallId, event.progress);
      }
      return false;

    case "done":
      onDone?.();
      return true; // doneReceived

    case "error":
      onError?.(new SagaApiError(event.message ?? "Unknown error"));
      return false;

    default:
      return false;
  }
}

/**
 * Process an SSE stream, dispatching events to callbacks.
 * Shared between sendSagaChatStreaming and sendToolResultStreaming.
 */
async function processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: Pick<
    SagaStreamOptions,
    "onContext" | "onDelta" | "onTool" | "onToolApprovalRequest" | "onProgress" | "onDone" | "onError"
  >
): Promise<void> {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const dataLines: string[] = [];
  let doneReceived = false;
  let consecutiveTimeouts = 0;
  let pendingRead: ReturnType<typeof reader.read> | null = null;

  try {
    while (true) {
      const readPromise: ReturnType<typeof reader.read> = pendingRead ?? reader.read();
      pendingRead = readPromise;

      let readResult: Awaited<ReturnType<typeof reader.read>>;
      try {
        readResult = await waitWithTimeout(readPromise);
        pendingRead = null;
        consecutiveTimeouts = 0;
      } catch (error) {
        if (error instanceof Error && error.message === "SSE read timeout") {
          consecutiveTimeouts += 1;
          if (consecutiveTimeouts < MAX_CONSECUTIVE_SSE_TIMEOUTS) {
            continue;
          }
        }
        throw error;
      }

      const { done, value } = readResult;
      if (done) break;

      chunks.push(decoder.decode(value, { stream: true }));
      const buffer = chunks.join("");
      const lines = buffer.split("\n");
      const remainder = lines.pop() ?? "";
      chunks.length = 0;
      if (remainder) chunks.push(remainder);

      for (const line of lines) {
        const event = handleSSELine(line, dataLines);
        if (!event) continue;
        if (handleSSEEvent(event, callbacks)) {
          doneReceived = true;
        }
      }
    }

    // Process remaining buffer
    const remainingBuffer = chunks.join("");
    if (remainingBuffer) {
      const lines = remainingBuffer.split("\n");
      for (const line of lines) {
        const event = handleSSELine(line, dataLines);
        if (!event) continue;
        if (handleSSEEvent(event, callbacks)) {
          doneReceived = true;
        }
      }
    }

    const finalEvent = flushSSEDataLines(dataLines);
    if (finalEvent) {
      if (handleSSEEvent(finalEvent, callbacks)) {
        doneReceived = true;
      }
    }

    // If stream ended naturally without "done" event, call onDone
    if (!doneReceived) {
      callbacks.onDone?.();
    }
  } finally {
    reader.releaseLock();
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
  const { signal, apiKey, authToken, onContext, onDelta, onTool, onToolApprovalRequest, onProgress, onDone, onError } =
    opts ?? {};

  const url = getAIEndpoint("/ai/saga");

  const resolvedAuthHeader = await resolveAuthHeader(authToken);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(resolvedAuthHeader && { Authorization: resolvedAuthHeader }),
    ...getAnonHeaders(),
  };

  if (apiKey) {
    headers["x-openrouter-key"] = apiKey;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "chat", ...payload, stream: true }),
      signal: createTimeoutSignal(API_TIMEOUTS.SSE_CONNECTION_MS, signal),
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

    // Process the SSE stream using shared helper
    await processSSEStream(reader, { onContext, onDelta, onTool, onToolApprovalRequest, onProgress, onDone, onError });
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
  opts: ExecuteToolOptions
): Promise<T> {
  const { projectId, signal, apiKey, authToken } = opts;

  if (!projectId) {
    throw new SagaApiError("projectId is required for tool execution", 400, "TOOL_EXECUTION_ERROR");
  }

  const url = getAIEndpoint("/ai/saga");

  const resolvedAuthHeader = await resolveAuthHeader(authToken);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(resolvedAuthHeader && { Authorization: resolvedAuthHeader }),
    ...getAnonHeaders(),
  };

  if (apiKey) {
    headers["x-openrouter-key"] = apiKey;
  }

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ kind: "execute_tool", projectId, toolName, input }),
    signal: createTimeoutSignal(API_TIMEOUTS.TOOL_EXECUTION_MS, signal),
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
  opts: ExecuteToolOptions
): Promise<GenesisWorldResult> {
  return executeSagaTool<GenesisWorldResult>("genesis_world", input, opts);
}

/**
 * Execute detect_entities to extract entities from text.
 */
export async function executeDetectEntities(
  input: DetectEntitiesArgs & { text: string },
  opts: ExecuteToolOptions
): Promise<DetectEntitiesResult> {
  return executeSagaTool<DetectEntitiesResult>("detect_entities", input, opts);
}

/**
 * Execute check_consistency to find contradictions and plot holes.
 */
export async function executeCheckConsistency(
  input: CheckConsistencyArgs & { text: string; entities?: unknown[] },
  opts: ExecuteToolOptions
): Promise<CheckConsistencyResult> {
  return executeSagaTool<CheckConsistencyResult>("check_consistency", input, opts);
}

/**
 * Execute generate_template to create a custom project template.
 */
export async function executeGenerateTemplate(
  input: GenerateTemplateArgs,
  opts: ExecuteToolOptions
): Promise<GenerateTemplateResult> {
  return executeSagaTool<GenerateTemplateResult>("generate_template", input, opts);
}

/**
 * Execute clarity_check tool.
 * Checks prose for word/phrase-level clarity issues.
 */
export async function executeClarityCheck(
  input: ClarityCheckArgs & { text: string },
  opts: ExecuteToolOptions
): Promise<ClarityCheckResult> {
  return executeSagaTool<ClarityCheckResult>("clarity_check", input, opts);
}

/**
 * Execute policy_check tool.
 * Checks prose against pinned style rules and policies.
 */
export async function executePolicyCheck(
  input: PolicyCheckArgs,
  opts: ExecuteToolOptions
): Promise<PolicyCheckResult> {
  return executeSagaTool<PolicyCheckResult>("policy_check", input, opts);
}

/**
 * Execute check_logic tool.
 * Validates story logic against explicit rules and world state.
 */
export async function executeCheckLogic(
  input: CheckLogicArgs & {
    text: string;
    magicSystems?: Array<{
      id: string;
      name: string;
      rules: string[];
      limitations: string[];
      costs?: string[];
    }>;
    characters?: Array<{
      id: string;
      name: string;
      powerLevel?: number;
      knowledge?: string[];
    }>;
  },
  opts: ExecuteToolOptions
): Promise<CheckLogicResult> {
  return executeSagaTool<CheckLogicResult>("check_logic", input, opts);
}

/**
 * Execute name_generator tool.
 * Generates culturally-aware, genre-appropriate names.
 */
export async function executeNameGenerator(
  input: NameGeneratorArgs,
  opts: ExecuteToolOptions
): Promise<NameGeneratorResult> {
  return executeSagaTool<NameGeneratorResult>("name_generator", input, opts);
}

// =============================================================================
// Tool Result API (Human-in-the-loop continuation)
// =============================================================================

export interface ToolResultPayload {
  projectId: string;
  threadId: string;
  promptMessageId: string;
  toolCallId: string;
  toolName: ToolName;
  result: unknown;
  editorContext?: EditorContext;
}

export async function sendToolResultStreaming(
  payload: ToolResultPayload,
  opts?: SagaStreamOptions
): Promise<void> {
  const { signal, apiKey, authToken, onContext, onDelta, onTool, onToolApprovalRequest, onProgress, onDone, onError } =
    opts ?? {};

  const url = getAIEndpoint("/ai/saga");

  const resolvedAuthHeader = await resolveAuthHeader(authToken);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(resolvedAuthHeader && { Authorization: resolvedAuthHeader }),
    ...getAnonHeaders(),
  };

  if (apiKey) {
    headers["x-openrouter-key"] = apiKey;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "tool-result", ...payload }),
      signal: createTimeoutSignal(API_TIMEOUTS.SSE_CONNECTION_MS, signal),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Tool result failed: ${response.status}`;
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

    await processSSEStream(reader, { onContext, onDelta, onTool, onToolApprovalRequest, onProgress, onDone, onError });
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
