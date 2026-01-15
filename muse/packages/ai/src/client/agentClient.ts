/**
 * Agent Runtime Client
 *
 * Unified, platform-agnostic client for the Saga AI endpoint.
 * Supports:
 * - Streaming chat with tool proposals
 * - Non-streaming tool execution
 *
 * Used by both web and React Native apps.
 */

import { API_TIMEOUTS, RETRY_CONFIG } from './config';
import type {
  ToolName,
  GenerateTemplateArgs,
  GenerateTemplateResult,
  SagaMode,
  AgentStreamEventType,
  ToolApprovalType,
  ToolApprovalDanger,
} from '@mythos/agent-protocol';
import type { UnifiedContextHints } from '@mythos/context';

// =============================================================================
// Types
// =============================================================================

export type SagaApiErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'ABORTED'
  | 'TOOL_ERROR'
  | 'TOOL_EXECUTION_ERROR'
  | 'UNKNOWN_ERROR';

export class SagaApiError extends Error {
  readonly statusCode?: number;
  readonly sagaCode: SagaApiErrorCode;

  constructor(message: string, statusCode?: number, code?: SagaApiErrorCode) {
    super(message);
    this.name = 'SagaApiError';
    this.statusCode = statusCode;
    this.sagaCode = code ?? 'UNKNOWN_ERROR';
  }
}

export interface StreamContext {
  threadId?: string;
}

export interface ChatMention {
  type: 'entity' | 'document';
  id: string;
  label?: string;
  name?: string;
}

export interface SagaChatPayload {
  prompt: string;
  projectId: string;
  mentions?: ChatMention[];
  contextHints?: UnifiedContextHints;
  mode?: SagaMode;
  threadId?: string;
  attachments?: Array<{
    kind: 'image';
    assetId?: string;
    storageId?: string;
    url?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    altText?: string;
  }>;
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: ToolName;
  args: unknown;
  promptMessageId?: string;
}

export type SagaStreamEventType = AgentStreamEventType;

export interface SagaStreamEvent {
  type: SagaStreamEventType;
  content?: string;
  data?: StreamContext;
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
  apiKey?: string;
  authToken?: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
  onContext?: (context: StreamContext) => void;
  onDelta?: (delta: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  onToolApprovalRequest?: (request: ToolApprovalRequest) => void;
  onProgress?: (toolCallId: string, progress: { pct?: number; stage?: string }) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface ExecuteToolOptions {
  projectId: string;
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
}

// =============================================================================
// Helpers
// =============================================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = RETRY_CONFIG.MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.BASE_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt),
            RETRY_CONFIG.MAX_DELAY_MS
          );
          await new Promise((r) => setTimeout(r, delay));
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
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

function parseSSEPayload(payload: string): SagaStreamEvent | null {
  const jsonStr = payload.trim();
  if (!jsonStr || jsonStr === '[DONE]') return null;
  try {
    return JSON.parse(jsonStr) as SagaStreamEvent;
  } catch {
    console.warn('[agentClient] Failed to parse SSE:', jsonStr);
    return null;
  }
}

function handleSSELine(line: string, dataLines: string[]): SagaStreamEvent | null {
  const normalized = line.replace(/\r$/, '');

  if (!normalized) {
    if (dataLines.length === 0) return null;
    const payload = dataLines.join('\n');
    dataLines.length = 0;
    return parseSSEPayload(payload);
  }

  if (normalized.startsWith(':')) return null;

  if (normalized.startsWith('data:')) {
    const data = normalized.slice(5);
    dataLines.push(data.startsWith(' ') ? data.slice(1) : data);
  }

  return null;
}

function flushSSEDataLines(dataLines: string[]): SagaStreamEvent | null {
  if (dataLines.length === 0) return null;
  const payload = dataLines.join('\n');
  dataLines.length = 0;
  return parseSSEPayload(payload);
}

function handleSSEEvent(
  event: SagaStreamEvent,
  callbacks: Pick<
    SagaStreamOptions,
    'onContext' | 'onDelta' | 'onTool' | 'onToolApprovalRequest' | 'onProgress' | 'onDone' | 'onError'
  >
): boolean {
  const { onContext, onDelta, onTool, onToolApprovalRequest, onProgress, onError } = callbacks;

  switch (event.type) {
    case 'context':
      onContext?.(event.data as StreamContext);
      return false;

    case 'delta':
      if (event.content) {
        onDelta?.(event.content);
      }
      return false;

    case 'tool':
      if (event.toolName && event.toolCallId) {
        onTool?.({
          toolCallId: event.toolCallId,
          toolName: event.toolName as ToolName,
          args: event.args,
          promptMessageId: event.promptMessageId,
        });
      }
      return false;

    case 'tool-approval-request':
      if (event.toolName && (event.approvalId || event.toolCallId)) {
        const approvalId = event.approvalId ?? event.toolCallId;
        onToolApprovalRequest?.({
          approvalId: approvalId as string,
          toolCallId: event.toolCallId,
          toolName: event.toolName as ToolName,
          args: event.args,
          approvalType: event.approvalType ?? 'execution',
          danger: event.danger,
          suggestionId: event.suggestionId,
          promptMessageId: event.promptMessageId,
        });
      }
      return false;

    case 'progress':
      if (event.toolCallId && event.progress) {
        onProgress?.(event.toolCallId, event.progress);
      }
      return false;

    case 'done':
      return true;

    case 'error':
      onError?.(new SagaApiError(event.message ?? 'Unknown error'));
      return false;

    default:
      return false;
  }
}

const MAX_CONSECUTIVE_SSE_TIMEOUTS = 2;

function waitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = API_TIMEOUTS.SSE_READ_MS,
  timeoutMessage = 'SSE read timeout'
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

async function processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: Pick<
    SagaStreamOptions,
    'onContext' | 'onDelta' | 'onTool' | 'onToolApprovalRequest' | 'onProgress' | 'onDone' | 'onError'
  >
): Promise<void> {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const dataLines: string[] = [];
  let doneReceived = false;
  let consecutiveTimeouts = 0;
  let pendingRead: ReturnType<typeof reader.read> | null = null;

  try {
    while (!doneReceived) {
      const readPromise: ReturnType<typeof reader.read> = pendingRead ?? reader.read();
      pendingRead = readPromise;

      let readResult: Awaited<ReturnType<typeof reader.read>>;
      try {
        readResult = await waitWithTimeout(readPromise);
        pendingRead = null;
        consecutiveTimeouts = 0;
      } catch (error) {
        if (error instanceof Error && error.message === 'SSE read timeout') {
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
      const buffer = chunks.join('');
      const lines = buffer.split('\n');
      const remainder = lines.pop() ?? '';
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
    const remainingBuffer = chunks.join('');
    if (remainingBuffer) {
      const lines = remainingBuffer.split('\n');
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
 */
export async function sendSagaChatStreaming(
  payload: SagaChatPayload,
  opts: SagaStreamOptions
): Promise<void> {
  const {
    signal,
    apiKey,
    authToken,
    baseUrl,
    extraHeaders,
    onContext,
    onDelta,
    onTool,
    onToolApprovalRequest,
    onProgress,
    onDone,
    onError,
  } = opts;

  const url = `${baseUrl}/api/ai/saga`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (authToken) {
    headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
  }

  if (apiKey) {
    headers['x-openrouter-key'] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUTS.SSE_CONNECTION_MS);

    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ kind: 'chat', ...payload, stream: true }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Saga request failed: ${response.status}`;
      let errorCode: SagaApiErrorCode = 'UNKNOWN_ERROR';

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
      throw new SagaApiError('No response body', 500);
    }

    await processSSEStream(reader, {
      onContext,
      onDelta,
      onTool,
      onToolApprovalRequest,
      onProgress,
      onDone,
      onError,
    });
  } catch (error) {
    if (error instanceof SagaApiError) {
      onError?.(error);
    } else if (error instanceof Error) {
      if (error.name === 'AbortError') return;
      onError?.(new SagaApiError(error.message));
    } else {
      onError?.(new SagaApiError('Unknown error occurred'));
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

async function executeSagaTool<T>(
  toolName: string,
  input: unknown,
  opts: ExecuteToolOptions
): Promise<T> {
  const { projectId, signal, apiKey, authToken, baseUrl, extraHeaders } = opts;

  if (!projectId) {
    throw new SagaApiError('projectId is required for tool execution', 400, 'TOOL_EXECUTION_ERROR');
  }

  const url = `${baseUrl}/api/ai/saga`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (authToken) {
    headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
  }

  if (apiKey) {
    headers['x-openrouter-key'] = apiKey;
  }

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ kind: 'execute_tool', projectId, toolName, input }),
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

    throw new SagaApiError(errorMessage, response.status, 'TOOL_EXECUTION_ERROR');
  }

  const data = (await response.json()) as ExecuteToolResponse<T>;
  return data.result;
}

/**
 * Execute generate_template to create a custom project template.
 */
export async function executeGenerateTemplate(
  input: GenerateTemplateArgs,
  opts: ExecuteToolOptions
): Promise<GenerateTemplateResult> {
  return executeSagaTool<GenerateTemplateResult>('generate_template', input, opts);
}

// =============================================================================
// Utility Functions
// =============================================================================

export function getErrorMessage(error: unknown): string {
  if (error instanceof SagaApiError) {
    switch (error.sagaCode) {
      case 'UNAUTHORIZED':
        return 'Please configure your API key in settings.';
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment.';
      case 'ABORTED':
        return '';
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') return '';
    return error.message;
  }
  return 'An unexpected error occurred.';
}
