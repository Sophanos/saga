/**
 * SSE Streaming Utilities
 *
 * Provides common patterns for Server-Sent Events streaming in edge functions.
 * Consolidates duplicate streaming code from ai-chat, ai-saga, and ai-agent.
 */

// =============================================================================
// SSE Event Types
// =============================================================================

export interface SSEContextEvent {
  type: "context";
  data: unknown;
}

export interface SSEDeltaEvent {
  type: "delta";
  content: string;
}

export interface SSEToolEvent {
  type: "tool";
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/**
 * SSE event for tool approval requests (AI SDK 6 needsApproval)
 * Sent when a tool with needsApproval returns true
 */
export interface SSEToolApprovalRequestEvent {
  type: "tool-approval-request";
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export interface SSEDoneEvent {
  type: "done";
}

export type SSEEvent =
  | SSEContextEvent
  | SSEDeltaEvent
  | SSEToolEvent
  | SSEToolApprovalRequestEvent
  | SSEErrorEvent
  | SSEDoneEvent;

// =============================================================================
// SSE Encoding
// =============================================================================

// Shared encoder instance
const encoder = new TextEncoder();

/**
 * Encode an SSE event to bytes
 */
export function encodeSSEEvent(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Create an SSE context event
 */
export function createContextEvent<T>(data: T): Uint8Array {
  return encodeSSEEvent({ type: "context", data });
}

/**
 * Create an SSE delta (text chunk) event
 */
export function createDeltaEvent(content: string): Uint8Array {
  return encodeSSEEvent({ type: "delta", content });
}

/**
 * Create an SSE tool call event
 */
export function createToolEvent(
  toolCallId: string,
  toolName: string,
  args: unknown
): Uint8Array {
  return encodeSSEEvent({ type: "tool", toolCallId, toolName, args });
}

/**
 * Create an SSE tool approval request event (AI SDK 6 needsApproval)
 */
export function createToolApprovalRequestEvent(
  toolCallId: string,
  toolName: string,
  args: unknown
): Uint8Array {
  return encodeSSEEvent({ type: "tool-approval-request", toolCallId, toolName, args });
}

/**
 * Create an SSE error event
 */
export function createErrorEvent(error: unknown): Uint8Array {
  const message = error instanceof Error ? error.message : "Unknown error";
  return encodeSSEEvent({ type: "error", message });
}

/**
 * Create an SSE done event
 */
export function createDoneEvent(): Uint8Array {
  return encodeSSEEvent({ type: "done" });
}

// =============================================================================
// Stream Controller Wrapper
// =============================================================================

/**
 * SSE Stream Controller wrapper for convenient event emission.
 * Provides a clean API for sending SSE events to a ReadableStream.
 */
export class SSEStreamController {
  constructor(
    private controller: ReadableStreamDefaultController<Uint8Array>
  ) {}

  /**
   * Send context metadata
   */
  sendContext<T>(data: T): void {
    this.controller.enqueue(createContextEvent(data));
  }

  /**
   * Send text delta
   */
  sendDelta(content: string): void {
    this.controller.enqueue(createDeltaEvent(content));
  }

  /**
   * Send tool call
   */
  sendTool(toolCallId: string, toolName: string, args: unknown): void {
    this.controller.enqueue(createToolEvent(toolCallId, toolName, args));
  }

  /**
   * Send tool approval request (AI SDK 6 needsApproval)
   */
  sendToolApprovalRequest(toolCallId: string, toolName: string, args: unknown): void {
    this.controller.enqueue(createToolApprovalRequestEvent(toolCallId, toolName, args));
  }

  /**
   * Send error event (does not close stream)
   */
  sendError(error: unknown): void {
    this.controller.enqueue(createErrorEvent(error));
  }

  /**
   * Send done and close stream
   */
  complete(): void {
    this.controller.enqueue(createDoneEvent());
    this.controller.close();
  }

  /**
   * Send error and close stream
   */
  fail(error: unknown): void {
    this.sendError(error);
    this.controller.close();
  }
}

// =============================================================================
// Stream Factory
// =============================================================================

/**
 * Create an SSE readable stream with a convenient controller wrapper.
 *
 * @example
 * ```ts
 * const stream = createSSEStream(async (sse) => {
 *   sse.sendContext({ documents: [], entities: [] });
 *
 *   for await (const chunk of result.textStream) {
 *     sse.sendDelta(chunk);
 *   }
 *
 *   sse.complete();
 * });
 *
 * return new Response(stream, {
 *   headers: getStreamingHeaders(origin),
 * });
 * ```
 */
export function createSSEStream(
  handler: (sse: SSEStreamController) => Promise<void>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const sse = new SSEStreamController(controller);
      try {
        await handler(sse);
      } catch (error) {
        console.error("[SSE] Stream error:", error);
        sse.fail(error);
      }
    },
  });
}

// =============================================================================
// SSE Response Creation
// =============================================================================

// Re-export getStreamingHeaders from cors.ts for convenience
export { getStreamingHeaders } from "./cors.ts";

/**
 * Create a complete SSE streaming response
 */
export function createSSEResponse(
  handler: (sse: SSEStreamController) => Promise<void>,
  origin: string | null
): Response {
  // Import dynamically to avoid circular dependency issues
  const headers: HeadersInit = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-openrouter-key",
  };

  return new Response(createSSEStream(handler), { headers });
}
