/**
 * @mythos/agent-protocol - SSE Stream Events
 *
 * Server-Sent Events types for agent streaming responses.
 */

import type { ToolName, ToolProgress } from "./tools";

// =============================================================================
// RAG Context
// =============================================================================

/**
 * Context data sent at the start of a response.
 */
export interface RAGContext {
  documents: Array<{
    id: string;
    title: string;
    preview: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    preview: string;
  }>;
}

// =============================================================================
// SSE Stream Events
// =============================================================================

/**
 * SSE event types for agent streaming.
 */
export type AgentStreamEventType =
  | "context"  // RAG context metadata
  | "delta"    // Text chunk
  | "tool"     // Tool call proposal
  | "progress" // Tool progress update
  | "done"     // Stream complete
  | "error";   // Error occurred

/**
 * SSE event payload for context.
 */
export interface ContextEvent {
  type: "context";
  data: RAGContext;
}

/**
 * SSE event payload for text delta.
 */
export interface DeltaEvent {
  type: "delta";
  content: string;
}

/**
 * SSE event payload for tool call.
 */
export interface ToolEvent {
  type: "tool";
  toolCallId: string;
  toolName: ToolName;
  args: unknown;
}

/**
 * SSE event payload for tool progress.
 */
export interface ProgressEvent {
  type: "progress";
  toolCallId: string;
  progress: ToolProgress;
}

/**
 * SSE event payload for stream completion.
 */
export interface DoneEvent {
  type: "done";
}

/**
 * SSE event payload for errors.
 */
export interface ErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

/**
 * Union of all possible SSE stream events.
 */
export type AgentStreamEvent =
  | ContextEvent
  | DeltaEvent
  | ToolEvent
  | ProgressEvent
  | DoneEvent
  | ErrorEvent;
