/**
 * SSE Streaming Utilities for Convex HTTP Actions
 *
 * Provides Server-Sent Events (SSE) streaming support for AI responses.
 * Mirrors the Supabase Edge Function streaming patterns for compatibility.
 */

// ============================================================
// SSE Event Types
// ============================================================

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
  promptMessageId?: string;
}

export type ToolApprovalType = "execution" | "input" | "apply";

export type ToolApprovalDanger = "safe" | "costly" | "destructive";

export interface SSEToolApprovalRequestEvent {
  type: "tool-approval-request";
  approvalId: string;
  toolCallId?: string;
  toolName: string;
  args: unknown;
  approvalType: ToolApprovalType;
  danger?: ToolApprovalDanger;
  promptMessageId?: string;
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

// ============================================================
// SSE Encoding
// ============================================================

const encoder = new TextEncoder();

export function encodeSSEEvent(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function createContextEvent<T>(data: T): Uint8Array {
  return encodeSSEEvent({ type: "context", data });
}

export function createDeltaEvent(content: string): Uint8Array {
  return encodeSSEEvent({ type: "delta", content });
}

export function createToolEvent(
  toolCallId: string,
  toolName: string,
  args: unknown,
  promptMessageId?: string
): Uint8Array {
  return encodeSSEEvent({ type: "tool", toolCallId, toolName, args, promptMessageId });
}

export function createToolApprovalRequestEvent(
  approvalId: string,
  toolName: string,
  args: unknown,
  approvalType: ToolApprovalType,
  danger?: ToolApprovalDanger,
  toolCallId?: string,
  promptMessageId?: string
): Uint8Array {
  return encodeSSEEvent({
    type: "tool-approval-request",
    approvalId,
    toolCallId,
    toolName,
    args,
    approvalType,
    danger,
    promptMessageId,
  });
}

export function createCommentEvent(comment: string): Uint8Array {
  return encoder.encode(`: ${comment}\n\n`);
}

export function createErrorEvent(error: unknown): Uint8Array {
  const message = error instanceof Error ? error.message : String(error);
  return encodeSSEEvent({ type: "error", message });
}

export function createDoneEvent(): Uint8Array {
  return encodeSSEEvent({ type: "done" });
}

// ============================================================
// SSE Stream Controller
// ============================================================

export class SSEStreamController {
  private controller: ReadableStreamDefaultController<Uint8Array>;
  private closed = false;

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller;
  }

  sendContext<T>(data: T): void {
    if (this.closed) return;
    this.controller.enqueue(createContextEvent(data));
  }

  sendDelta(content: string): void {
    if (this.closed) return;
    this.controller.enqueue(createDeltaEvent(content));
  }

  sendTool(toolCallId: string, toolName: string, args: unknown, promptMessageId?: string): void {
    if (this.closed) return;
    this.controller.enqueue(createToolEvent(toolCallId, toolName, args, promptMessageId));
  }

  sendToolApprovalRequest(
    approvalId: string,
    toolName: string,
    args: unknown,
    approvalType: ToolApprovalType,
    danger?: ToolApprovalDanger,
    toolCallId?: string,
    promptMessageId?: string
  ): void {
    if (this.closed) return;
    this.controller.enqueue(
      createToolApprovalRequestEvent(
        approvalId,
        toolName,
        args,
        approvalType,
        danger,
        toolCallId,
        promptMessageId
      )
    );
  }

  sendComment(comment: string): void {
    if (this.closed) return;
    this.controller.enqueue(createCommentEvent(comment));
  }

  sendError(error: unknown): void {
    if (this.closed) return;
    this.controller.enqueue(createErrorEvent(error));
  }

  complete(): void {
    if (this.closed) return;
    this.controller.enqueue(createDoneEvent());
    this.controller.close();
    this.closed = true;
  }

  fail(error: unknown): void {
    if (this.closed) return;
    this.sendError(error);
    this.controller.close();
    this.closed = true;
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

// ============================================================
// Stream Factory
// ============================================================

const KEEPALIVE_INTERVAL_MS = 15_000;

export function createSSEStream(
  handler: (sse: SSEStreamController) => Promise<void>
): ReadableStream<Uint8Array> {
  let keepalive: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream({
    async start(controller) {
      const sse = new SSEStreamController(controller);
      keepalive = setInterval(() => {
        if (sse.isClosed) return;
        sse.sendComment("keep-alive");
      }, KEEPALIVE_INTERVAL_MS);

      try {
        await handler(sse);
      } catch (error) {
        console.error("[SSE] Stream error:", error);
        sse.fail(error);
      } finally {
        if (keepalive) {
          clearInterval(keepalive);
          keepalive = null;
        }
      }
    },
    cancel() {
      if (keepalive) {
        clearInterval(keepalive);
        keepalive = null;
      }
    },
  });
}

// ============================================================
// Headers
// ============================================================

export function getStreamingHeaders(origin: string | null): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-openrouter-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function getCorsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-openrouter-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
