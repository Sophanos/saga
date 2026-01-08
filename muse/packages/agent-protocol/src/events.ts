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
  threadId?: string;
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
  memories?: Array<{
    id: string;
    category: string;
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
  | "context"              // RAG context metadata
  | "delta"                // Text chunk
  | "tool"                 // Tool call (no approval needed)
  | "tool-approval-request" // AI SDK 6: Tool requires user approval
  | "progress"             // Tool progress update
  | "done"                 // Stream complete
  | "error";               // Error occurred

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
 * SSE event payload for tool call (tool does not need approval).
 */
export interface ToolEvent {
  type: "tool";
  toolCallId: string;
  toolName: ToolName;
  args: unknown;
  promptMessageId?: string;
}

/**
 * SSE event payload for tool approval request (AI SDK 6 needsApproval).
 * Sent when a tool with needsApproval=true needs user consent before execution.
 */
export interface ToolApprovalRequestEvent {
  type: "tool-approval-request";
  /** Unique approval ID required for tool-approval-response */
  approvalId: string;
  /** Tool call ID (if provided by the model) */
  toolCallId?: string;
  toolName: ToolName;
  args: unknown;
  promptMessageId?: string;
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
  | ToolApprovalRequestEvent
  | ProgressEvent
  | DoneEvent
  | ErrorEvent;
