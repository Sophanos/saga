/**
 * Widget Client
 *
 * Platform-agnostic streaming client for widget execution.
 * Used by both web and React Native apps.
 */

import type { WidgetInvokeRequest, ArtifactManifestDraft, WidgetExecutionStatus } from '@mythos/agent-protocol';

// =============================================================================
// Types
// =============================================================================

export type WidgetApiErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'ABORTED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export class WidgetApiError extends Error {
  readonly statusCode?: number;
  readonly code: WidgetApiErrorCode;

  constructor(message: string, statusCode?: number, code?: WidgetApiErrorCode) {
    super(message);
    this.name = 'WidgetApiError';
    this.statusCode = statusCode;
    this.code = code ?? 'UNKNOWN_ERROR';
  }
}

export type WidgetStreamEventType = 'context' | 'delta' | 'done' | 'error';

export interface WidgetStreamEvent {
  type: WidgetStreamEventType;
  content?: string;
  data?: unknown;
  message?: string;
}

export interface WidgetContextData {
  stage?: WidgetExecutionStatus;
  result?: {
    executionId?: string;
    widgetType?: 'inline' | 'artifact';
    titleSuggestion?: string;
    manifestDraft?: ArtifactManifestDraft | null;
  };
}

export interface WidgetStreamOptions {
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
  baseUrl: string;
  onContext?: (data: WidgetContextData) => void;
  onDelta?: (content: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// SSE Parsing
// =============================================================================

function parseSSELine(line: string): WidgetStreamEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  try {
    const json = line.slice(6);
    return JSON.parse(json) as WidgetStreamEvent;
  } catch {
    console.warn('[widgetClient] Failed to parse SSE line:', line);
    return null;
  }
}

// =============================================================================
// Widget Streaming Client
// =============================================================================

export async function sendWidgetRunStreaming(
  payload: WidgetInvokeRequest,
  opts: WidgetStreamOptions
): Promise<void> {
  const { signal, apiKey, authToken, baseUrl, onContext, onDelta, onDone, onError } = opts;

  const url = `${baseUrl}/ai/widgets`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['x-openrouter-key'] = apiKey;
  }

  if (authToken) {
    headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `Widget request failed: ${response.status}`;
      let errorCode: WidgetApiErrorCode = 'UNKNOWN_ERROR';

      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
        if (errorData.error?.code) {
          errorCode = errorData.error.code as WidgetApiErrorCode;
        }
      } catch {
        // Ignore JSON parse failures
      }

      throw new WidgetApiError(errorMessage, response.status, errorCode);
    }

    if (!response.body) {
      throw new WidgetApiError('No response body', 500, 'SERVER_ERROR');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith(':')) continue;

        const event = parseSSELine(line);
        if (!event) continue;

        switch (event.type) {
          case 'context':
            onContext?.(event.data as WidgetContextData);
            break;
          case 'delta':
            if (event.content) {
              onDelta?.(event.content);
            }
            break;
          case 'error':
            onError?.(new Error(event.message ?? 'Widget error'));
            break;
          case 'done':
            onDone?.();
            break;
        }
      }
    }
  } catch (error) {
    if (error instanceof WidgetApiError) {
      onError?.(error);
    } else {
      const err = error instanceof Error ? error : new Error('Unknown widget error');
      onError?.(err);
    }
  }
}
