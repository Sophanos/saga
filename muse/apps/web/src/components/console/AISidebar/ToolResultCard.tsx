import { useCallback, useState } from "react";
import { useAction } from "convex/react";
import {
  GitBranch,
  FileText,
  Check,
  X,
  Loader2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Sparkles,
  ScanSearch,
  ShieldCheck,
  LayoutTemplate,
  Wand2,
  ShieldAlert,
  ImageIcon,
  ExternalLink,
  ListTodo,
  Workflow,
} from "lucide-react";
import { Button, cn } from "@mythos/ui";
import {
  useMythosStore,
  type ChatMessage,
  type ChatToolInvocation,
  type ToolInvocationStatus,
} from "../../../stores";
import { useToolRuntime } from "../../../hooks/useToolRuntime";
import { generateMessageId } from "../../../hooks/createAgentHook";
import { sendToolResultStreaming, type ToolCallResult, type ToolApprovalRequest } from "../../../services/ai/agentRuntimeClient";
import { useApiKey } from "../../../hooks/useApiKey";
import { getToolLabel, getToolDanger, renderToolSummary } from "../../../tools";
import { getEntityIconComponent } from "../../../utils/entityConfig";
import type { EntityType } from "@mythos/core";
import type {
  AskQuestionArgs,
  AskQuestionResult,
  WriteContentOperation,
  WriteContentResult,
  WriteTodosArgs,
  SpawnTaskArgs,
  SpawnTaskResult,
  ToolApprovalType,
  ToolApprovalDanger,
  ToolName,
} from "@mythos/agent-protocol";
import type { SagaSessionWriter } from "../../../hooks/useSessionHistory";
import { api } from "../../../../../../convex/_generated/api";
import { AskQuestion } from "./ask-question";
import { TodoListCard } from "./TodoListCard";
import { SpawnTaskCard } from "./SpawnTaskCard";

interface ToolResultCardProps {
  messageId: string;
  tool: ChatToolInvocation;
  sessionWriter?: SagaSessionWriter;
}

function getStatusIcon(status: ToolInvocationStatus) {
  switch (status) {
    case "proposed":
      return null;
    case "accepted":
    case "executing":
      return <Loader2 className="w-3.5 h-3.5 text-mythos-accent-primary animate-spin" />;
    case "executed":
      return <Check className="w-3.5 h-3.5 text-mythos-accent-green" />;
    case "rejected":
    case "canceled":
      return <X className="w-3.5 h-3.5 text-mythos-text-muted" />;
    case "failed":
      return <AlertCircle className="w-3.5 h-3.5 text-mythos-accent-red" />;
    default:
      return null;
  }
}

function getStatusLabel(status: ToolInvocationStatus): string {
  switch (status) {
    case "proposed":
      return "Proposed";
    case "accepted":
      return "Starting...";
    case "executing":
      return "Creating...";
    case "executed":
      return "Created";
    case "rejected":
      return "Rejected";
    case "canceled":
      return "Canceled";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function getCardStyles(
  status: ToolInvocationStatus,
  danger: "safe" | "destructive" | "costly",
  needsApproval?: boolean
) {
  if (status === "proposed") {
    // SDK-level approval gets a more prominent style
    if (needsApproval) {
      return "border-mythos-accent-yellow/40 bg-mythos-accent-yellow/10";
    }
    if (danger === "destructive") {
      return "border-mythos-accent-red/30 bg-mythos-accent-red/5";
    }
    return "border-mythos-accent-purple/30 bg-mythos-accent-purple/5";
  }
  if (status === "executed") {
    return "border-mythos-accent-green/30 bg-mythos-accent-green/5";
  }
  if (status === "failed") {
    return "border-mythos-accent-red/30 bg-mythos-accent-red/5";
  }
  return "border-mythos-border-default bg-mythos-bg-tertiary/50";
}

function resolveDefaultApprovalType(toolName: ToolName): ToolApprovalType | undefined {
  if (toolName === "ask_question") return "input";
  if (toolName === "write_content") return "apply";
  return undefined;
}

function getApprovalBadgeLabel(approvalType?: ToolApprovalType): string | null {
  switch (approvalType) {
    case "input":
      return "Input Required";
    case "apply":
      return "Apply Suggestion";
    case "execution":
      return "Approval Required";
    default:
      return null;
  }
}

export function ToolResultCard({ messageId, tool, sessionWriter }: ToolResultCardProps) {
  const { acceptTool, rejectTool, retryTool, cancelTool } = useToolRuntime();
  const { key: apiKey } = useApiKey();
  const apiAny: any = api;
  const resolveWriteContentFromEditor = useAction(
    apiAny.knowledgeSuggestions.resolveWriteContentFromEditor as any
  );

  const projectId = useMythosStore((s) => s.project.currentProject?.id);
  const threadId = useMythosStore((s) => s.chat.conversationId);
  const setChatContext = useMythosStore((s) => s.setChatContext);
  const addChatMessage = useMythosStore((s) => s.addChatMessage);
  const updateChatMessage = useMythosStore((s) => s.updateChatMessage);
  const appendToChatMessage = useMythosStore((s) => s.appendToChatMessage);
  const setChatStreaming = useMythosStore((s) => s.setChatStreaming);
  const setChatError = useMythosStore((s) => s.setChatError);
  const updateToolInvocation = useMythosStore((s) => s.updateToolInvocation);
  const applyWriteContentSuggestion = useMythosStore((s) => s.applyWriteContentSuggestion);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const args = (tool.args ?? {}) as Record<string, unknown>;
  const getArg = <T,>(key: string, fallback?: T): T | undefined =>
    (args[key] as T | undefined) ?? fallback;

  const isProposed = tool.status === "proposed";
  const isExecuting = tool.status === "accepted" || tool.status === "executing";
  const isFailed = tool.status === "failed";
  const isCanceled = tool.status === "canceled";
  const canRetry = isFailed || isCanceled;
  const isAskQuestion = tool.toolName === "ask_question";
  const isWriteContent = tool.toolName === "write_content";
  const isWriteTodos = tool.toolName === "write_todos";
  const isSpawnTask = tool.toolName === "spawn_task";

  const approvalType =
    tool.approvalType ??
    resolveDefaultApprovalType(tool.toolName) ??
    (tool.needsApproval ? "execution" : undefined);
  const danger = (tool.danger ?? getToolDanger(tool.toolName)) as ToolApprovalDanger;
  const label = getToolLabel(tool.toolName);
  const summary = renderToolSummary(tool.toolName, tool.args);
  const needsApproval = tool.needsApproval ?? approvalType !== undefined;
  const approvalBadgeLabel = getApprovalBadgeLabel(approvalType);

  // Handle accepting the tool proposal
  const handleAccept = useCallback(async () => {
    try {
      await acceptTool(messageId);
    } catch (error) {
      console.error("Failed to accept tool:", error);
      // Error is displayed via tool.error in the UI
    }
  }, [messageId, acceptTool]);

  // Handle rejecting the tool proposal
  const handleReject = useCallback(() => {
    rejectTool(messageId);
  }, [messageId, rejectTool]);

  // Handle canceling an executing tool
  const handleCancel = useCallback(() => {
    cancelTool(messageId);
  }, [messageId, cancelTool]);

  // Handle retrying a failed tool
  const handleRetry = useCallback(async () => {
    try {
      await retryTool(messageId);
    } catch (error) {
      console.error("Failed to retry tool:", error);
      // Error is displayed via tool.error in the UI
    }
  }, [messageId, retryTool]);

  const persistSessionMessage = useCallback(
    (message: ChatMessage) => {
      if (!sessionWriter) return;
      if (message.kind === "tool") {
        sessionWriter.persistToolMessage?.(message);
      } else if (message.role === "user") {
        sessionWriter.persistUserMessage?.(message);
      } else {
        sessionWriter.persistAssistantMessage?.(message);
      }
    },
    [sessionWriter]
  );

  const getSelectionRange = useCallback(() => {
    const editor = useMythosStore.getState().editor.editorInstance as
      | { state: { selection: { from: number; to: number } }; isDestroyed?: boolean }
      | null;
    if (!editor || editor.isDestroyed) return undefined;
    const { from, to } = editor.state.selection;
    return { from, to };
  }, []);

  const handleIncomingTool = useCallback(
    (
      incoming: ToolCallResult,
      options?: {
        needsApproval?: boolean;
        approvalId?: string;
        approvalType?: ToolApprovalType;
        danger?: ToolApprovalDanger;
      }
    ) => {
      const resolvedApprovalType =
        options?.approvalType ?? resolveDefaultApprovalType(incoming.toolName as ToolName);
      const needsApproval = options?.needsApproval ?? resolvedApprovalType !== undefined;
      const selectionRange =
        incoming.toolName === "write_content" ? getSelectionRange() : undefined;
      const toolMessage: ChatMessage = {
        id: incoming.toolCallId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        kind: "tool",
        tool: {
          toolCallId: incoming.toolCallId,
          approvalId: options?.approvalId,
          toolName: incoming.toolName as ChatToolInvocation["toolName"],
          args: incoming.args,
          promptMessageId: incoming.promptMessageId,
          selectionRange,
          status: "proposed",
          needsApproval,
          approvalType: resolvedApprovalType,
          danger: options?.danger,
        },
      };
      addChatMessage(toolMessage);
      persistSessionMessage(toolMessage);
    },
    [addChatMessage, getSelectionRange, persistSessionMessage]
  );

  const streamToolResult = useCallback(
    async (resultPayload: AskQuestionResult | WriteContentResult, finalStatus: ToolInvocationStatus) => {
      if (!projectId) {
        updateToolInvocation(messageId, { status: "failed", error: "Project not available" });
        return;
      }
      if (!threadId) {
        updateToolInvocation(messageId, { status: "failed", error: "Thread not available" });
        return;
      }
      if (!tool.promptMessageId) {
        updateToolInvocation(messageId, { status: "failed", error: "Missing prompt message ID" });
        return;
      }

      const assistantMessageId = generateMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      addChatMessage(assistantMessage);
      setChatStreaming(true);
      setIsSubmitting(true);
      updateToolInvocation(messageId, { status: "executing" });

      try {
        await sendToolResultStreaming(
          {
            projectId,
            threadId,
            promptMessageId: tool.promptMessageId,
            toolCallId: tool.toolCallId,
            toolName: tool.toolName,
            result: resultPayload,
          },
          {
            apiKey: apiKey ?? undefined,
            onContext: (context) => {
              setChatContext(context);
            },
            onDelta: (delta) => {
              appendToChatMessage(assistantMessageId, delta);
            },
            onTool: (incoming) => {
              handleIncomingTool(incoming);
            },
            onToolApprovalRequest: (request: ToolApprovalRequest) => {
              handleIncomingTool(
                {
                  toolCallId: request.toolCallId ?? request.approvalId,
                  toolName: request.toolName,
                  args: request.args,
                  promptMessageId: request.promptMessageId,
                },
                {
                  needsApproval: true,
                  approvalId: request.approvalId,
                  approvalType: request.approvalType,
                  danger: request.danger,
                }
              );
            },
            onDone: () => {
              updateChatMessage(assistantMessageId, { isStreaming: false });
              setChatStreaming(false);
              const currentMsgs = useMythosStore.getState().chat.messages;
              const finalMessage = currentMsgs.find((m) => m.id === assistantMessageId);
              if (finalMessage && finalMessage.content) {
                persistSessionMessage(finalMessage);
              }
              updateToolInvocation(messageId, { status: finalStatus, result: resultPayload });
            },
            onError: (err) => {
              updateChatMessage(assistantMessageId, { isStreaming: false });
              setChatStreaming(false);
              setChatError(err.message);
              updateToolInvocation(messageId, { status: "failed", error: err.message });
            },
          }
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send tool result";
        updateToolInvocation(messageId, { status: "failed", error: message });
        setChatError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      projectId,
      threadId,
      tool.promptMessageId,
      tool.toolCallId,
      tool.toolName,
      apiKey,
      messageId,
      addChatMessage,
      appendToChatMessage,
      updateChatMessage,
      setChatStreaming,
      setChatError,
      updateToolInvocation,
      setChatContext,
      handleIncomingTool,
      persistSessionMessage,
    ]
  );

  const handleSubmitAskQuestion = useCallback(
    async (result: AskQuestionResult) => {
      if (!isAskQuestion) return;
      await streamToolResult(result, "executed");
    },
    [isAskQuestion, streamToolResult]
  );

  const handleSkipQuestion = useCallback(async () => {
    if (!isAskQuestion) return;
    const questionArgs = tool.args as AskQuestionArgs;
    // Build a skipped result for all questions
    const result: AskQuestionResult = {
      answers: Object.fromEntries(
        questionArgs.questions.map((q) => [q.id, { answer: "", skipped: true }])
      ),
      complete: false,
    };
    await streamToolResult(result, "rejected");
  }, [isAskQuestion, streamToolResult, tool.args]);

  const handleApplyWriteContent = useCallback(async () => {
    if (!isWriteContent) return;
    const applyResult = await applyWriteContentSuggestion(tool.toolCallId);
    if (!applyResult.applied) {
      updateToolInvocation(messageId, { status: "failed", error: applyResult.error });
      return;
    }
    if (applyResult.documentId && applyResult.snapshotJson) {
      try {
        await resolveWriteContentFromEditor({
          toolCallId: tool.toolCallId,
          applied: true,
          documentId: applyResult.documentId,
          snapshotJson: applyResult.snapshotJson,
          reason: applyResult.summary,
        });
      } catch (error) {
        console.warn("[ToolResultCard] Failed to resolve write_content from editor:", error);
      }
    }
    const operation = (applyResult.appliedOperation ??
      (getArg<WriteContentOperation>("operation", "insert_at_cursor") as WriteContentOperation));
    const result: WriteContentResult = {
      applied: true,
      appliedOperation: operation,
      summary: applyResult.summary,
      insertedTextPreview: applyResult.insertedTextPreview,
    };
    await streamToolResult(result, "executed");
  }, [
    applyWriteContentSuggestion,
    getArg,
    isWriteContent,
    messageId,
    resolveWriteContentFromEditor,
    tool.toolCallId,
    updateToolInvocation,
    streamToolResult,
  ]);

  const handleRejectWriteContent = useCallback(async () => {
    if (!isWriteContent) return;
    const operation = getArg<WriteContentOperation>("operation", "insert_at_cursor") as WriteContentOperation;
    const result: WriteContentResult = {
      applied: false,
      appliedOperation: operation,
    };
    await streamToolResult(result, "rejected");
  }, [getArg, isWriteContent, streamToolResult]);

  // Get icon based on tool type
  const getIcon = () => {
    // Core entity/relationship tools
    if (tool.toolName === "create_entity" || tool.toolName === "update_entity") {
      const entityType = getArg<EntityType>("type") ?? "character";
      const Icon = getEntityIconComponent(entityType);
      return <Icon className="w-4 h-4" />;
    }
    if (tool.toolName === "delete_entity") {
      return <Trash2 className="w-4 h-4" />;
    }
    if (
      tool.toolName === "create_relationship" ||
      tool.toolName === "update_relationship" ||
      tool.toolName === "delete_relationship"
    ) {
      return <GitBranch className="w-4 h-4" />;
    }
    if (tool.toolName === "generate_content") {
      return <Wand2 className="w-4 h-4" />;
    }
    if (tool.toolName === "generate_image") {
      return <ImageIcon className="w-4 h-4" />;
    }
    // Saga unified agent tools
    if (tool.toolName === "project_manage") {
      return <Sparkles className="w-4 h-4" />;
    }
    if (tool.toolName === "genesis_world") {
      return <Sparkles className="w-4 h-4" />;
    }
    if (tool.toolName === "detect_entities") {
      return <ScanSearch className="w-4 h-4" />;
    }
    if (tool.toolName === "check_consistency") {
      return <ShieldCheck className="w-4 h-4" />;
    }
    if (tool.toolName === "generate_template") {
      return <LayoutTemplate className="w-4 h-4" />;
    }
    if (tool.toolName === "write_todos") {
      return <ListTodo className="w-4 h-4" />;
    }
    if (tool.toolName === "spawn_task") {
      return <Workflow className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  // Get action button label based on tool type
  const getActionLabel = () => {
    // Saga unified agent tools
    if (tool.toolName === "project_manage") {
      return "Run";
    }
    if (tool.toolName === "genesis_world") {
      return "Generate";
    }
    if (tool.toolName === "detect_entities") {
      return "Detect";
    }
    if (tool.toolName === "check_consistency") {
      return "Check";
    }
    if (tool.toolName === "generate_template") {
      return "Generate";
    }
    if (tool.toolName === "generate_content") {
      return "Generate";
    }
    if (tool.toolName === "generate_image") {
      return "Generate";
    }
    // Core entity/relationship tools
    if (tool.toolName.startsWith("delete_")) {
      return "Delete";
    }
    if (tool.toolName.startsWith("update_")) {
      return "Update";
    }
    return "Create";
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3 my-2",
        getCardStyles(tool.status, danger, needsApproval)
      )}
      data-testid="tool-result-card"
      data-tool-name={tool.toolName}
      data-tool-status={tool.status}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center",
            needsApproval && isProposed
              ? "bg-mythos-accent-yellow/20 text-mythos-accent-yellow"
              : danger === "destructive"
                ? "bg-mythos-accent-red/20 text-mythos-accent-red"
                : "bg-mythos-bg-tertiary text-mythos-accent-purple"
          )}
        >
          {needsApproval && isProposed ? (
            <ShieldAlert className="w-4 h-4" />
          ) : (
            getIcon()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-mythos-text-primary truncate">
              {label}
            </span>
            {needsApproval && isProposed && approvalBadgeLabel && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-mythos-accent-yellow/20 text-mythos-accent-yellow font-medium">
                {approvalBadgeLabel}
              </span>
            )}
          </div>
          <div className="text-[10px] text-mythos-text-muted truncate">
            {summary}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {getStatusIcon(tool.status)}
          <span
            className={cn(
              "text-[10px]",
              tool.status === "executed"
                ? "text-mythos-accent-green"
                : tool.status === "failed"
                  ? "text-mythos-accent-red"
                  : "text-mythos-text-muted"
            )}
          >
            {getStatusLabel(tool.status)}
          </span>
        </div>
      </div>

      {/* Ask question preview (when not proposed) */}
      {isAskQuestion && !isProposed && (
        <div className="mb-2 space-y-1">
          <p className="text-xs text-mythos-text-primary">
            {(tool.args as AskQuestionArgs).questions?.[0]?.question ?? ""}
          </p>
        </div>
      )}

      {isWriteContent && (
        <div className="mb-2 space-y-2">
          {getArg<string>("rationale") && (
            <p className="text-xs text-mythos-text-muted">
              {getArg<string>("rationale")}
            </p>
          )}
          {getArg<string>("content") && (
            <pre className="text-xs text-mythos-text-primary bg-mythos-bg-secondary/60 border border-mythos-border-default rounded-md p-2 whitespace-pre-wrap max-h-40 overflow-auto">
              {getArg<string>("content")}
            </pre>
          )}
        </div>
      )}

      {/* Todo list rendering */}
      {isWriteTodos && (
        <div className="mb-2">
          <TodoListCard args={tool.args as WriteTodosArgs} />
        </div>
      )}

      {/* Spawn task rendering */}
      {isSpawnTask && (
        <div className="mb-2">
          <SpawnTaskCard
            args={tool.args as SpawnTaskArgs}
            result={tool.result as SpawnTaskResult | undefined}
            isExecuting={isExecuting}
          />
        </div>
      )}

      {getArg<string>("notes") && (
        <p className="text-xs text-mythos-text-muted mb-2 line-clamp-2">
          {getArg<string>("notes")}
        </p>
      )}

      {/* Progress for long-running operations */}
      {tool.progress && (
        <div className="mb-2">
          {tool.progress.stage && (
            <p className="text-xs text-mythos-text-muted mb-1">{tool.progress.stage}</p>
          )}
          {tool.progress.pct !== undefined && (
            <div className="h-1 bg-mythos-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-mythos-accent-primary transition-all"
                style={{ width: `${tool.progress.pct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {tool.error && (
        <p className="text-xs text-mythos-accent-red mb-2">{tool.error}</p>
      )}

      {/* Image artifacts */}
      {tool.status === "executed" && tool.artifacts && tool.artifacts.length > 0 && (
        <div className="mt-2 space-y-2">
          {tool.artifacts
            .filter((a) => a.kind === "image" && (a.url || a.previewUrl))
            .map((artifact, i) => (
              <div
                key={i}
                className="relative rounded-lg overflow-hidden border border-mythos-border-default bg-mythos-bg-tertiary group cursor-pointer"
                onClick={() => window.open(artifact.url ?? artifact.previewUrl, "_blank")}
              >
                <img
                  src={artifact.previewUrl ?? artifact.url}
                  alt={artifact.title ?? "Generated image"}
                  className="w-full h-auto max-h-48 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ExternalLink className="w-6 h-6 text-white" />
                </div>
                {artifact.title && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <span className="text-xs text-white truncate block">{artifact.title}</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Ask Question UI */}
      {isProposed && isAskQuestion && (
        <div className="mt-2" data-testid="tool-approval-request">
          <AskQuestion
            args={tool.args as AskQuestionArgs}
            onSubmit={handleSubmitAskQuestion}
            onSkip={handleSkipQuestion}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {isProposed && isWriteContent && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleApplyWriteContent}
            disabled={isSubmitting}
            variant={danger === "destructive" ? "destructive" : "default"}
            className="flex-1 h-7 text-xs gap-1"
          >
            <Check className="w-3 h-3" />
            Apply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRejectWriteContent}
            disabled={isSubmitting}
            className="flex-1 h-7 text-xs gap-1"
          >
            <X className="w-3 h-3" />
            Reject
          </Button>
        </div>
      )}

      {isProposed && !isAskQuestion && !isWriteContent && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleAccept}
            variant={
              needsApproval
                ? "default"
                : danger === "destructive"
                  ? "destructive"
                  : "default"
            }
            className={cn(
              "flex-1 h-7 text-xs gap-1",
              needsApproval && "bg-mythos-accent-yellow hover:bg-mythos-accent-yellow/90 text-black"
            )}
            data-testid="tool-approval-accept"
          >
            <Check className="w-3 h-3" />
            {needsApproval ? "Approve Execution" : getActionLabel()}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            className="flex-1 h-7 text-xs gap-1"
            data-testid="tool-approval-reject"
          >
            <X className="w-3 h-3" />
            {needsApproval ? "Deny" : "Cancel"}
          </Button>
        </div>
      )}

      {/* Cancel button for executing state */}
      {isExecuting && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="w-full h-7 text-xs gap-1"
          >
            <X className="w-3 h-3" />
            Cancel
          </Button>
        </div>
      )}

      {/* Retry button for failed/canceled state */}
      {canRetry && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleRetry}
            className="w-full h-7 text-xs gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
