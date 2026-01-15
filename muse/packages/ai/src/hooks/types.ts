/**
 * Shared Saga agent hook types.
 */

import type { ToolApprovalDanger, ToolApprovalType, ToolName, SagaMode } from "@mythos/agent-protocol";
import type { ChatMention, SagaChatPayload, ToolApprovalRequest, ToolCallResult } from "../client/agentClient";
import type { UnifiedContextHints } from "@mythos/context";

export type { SagaChatPayload, ToolApprovalRequest, ToolCallResult };
export type { SagaMode };

export type ChatAttachment = {
  kind: "image";
  assetId?: string;
  storageId?: string;
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  altText?: string;
  dataUrl?: string;
};

export interface SagaAgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  mentions?: ChatMention[];
  attachments?: ChatAttachment[];
  kind?: "tool";
  tool?: {
    toolCallId: string;
    approvalId?: string;
    toolName: ToolName;
    args: unknown;
    status: "proposed" | "accepted" | "executing" | "executed" | "rejected" | "failed";
    needsApproval?: boolean;
    approvalType?: ToolApprovalType;
    danger?: ToolApprovalDanger;
    promptMessageId?: string;
    selectionRange?: { from: number; to: number };
  };
  isStreaming?: boolean;
}

export interface SagaAgentStoreAdapter {
  getProjectId(): string | null;
  getConversationId(): string | undefined;
  isNewConversation(): boolean;
  getIsStreaming(): boolean;
  getError(): string | null;

  addMessage(message: SagaAgentMessage): void;
  updateMessage(id: string, patch: Partial<SagaAgentMessage>): void;
  appendAssistantDelta(id: string, delta: string): void;

  setStreaming(isStreaming: boolean): void;
  setError(error: string | null): void;
  setConversationId(threadId: string): void;

  updateToolProgress?(toolCallId: string, progress: { pct?: number; stage?: string }): void;

  startNewConversation(): void;
  clearChat(): void;
}

export interface SagaAgentPlatformAdapter {
  getApiKey?(): string | undefined;
  getAuthToken?(): Promise<string | null>;
  getExtraHeaders?(): Record<string, string>;

  getEditorContext?(): unknown;
  getSelectionRange?(): { from: number; to: number } | undefined;
  getContextHints?(threadId?: string): UnifiedContextHints | undefined;

  persistMessage?(message: SagaAgentMessage): void;
}

export interface SagaAgentStreamOptions {
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
  extraHeaders?: Record<string, string>;
  onContext?: (context: { threadId?: string } & Record<string, unknown>) => void;
  onDelta?: (delta: string) => void;
  onTool?: (tool: ToolCallResult) => void;
  onToolApprovalRequest?: (request: ToolApprovalRequest) => void;
  onProgress?: (toolCallId: string, progress: { pct?: number; stage?: string }) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface UseSagaAgentOptions {
  enabled?: boolean;
  initialMode?: SagaMode;
  store: SagaAgentStoreAdapter;
  platform: SagaAgentPlatformAdapter;
  sendSagaChatStreaming: (payload: SagaChatPayload, opts: SagaAgentStreamOptions) => Promise<void>;
}

export interface UseSagaAgentResult {
  sendMessage: (
    content: string,
    options?: { mentions?: ChatMention[]; attachments?: ChatAttachment[] }
  ) => Promise<void>;
  stopStreaming: () => void;
  clearChat: () => void;
  newConversation: () => void;
  isStreaming: boolean;
  error: string | null;
  setMode: (mode: SagaMode) => void;
  mode: SagaMode;
}
