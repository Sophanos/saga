import { useCallback } from "react";
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
} from "lucide-react";
import { Button, cn } from "@mythos/ui";
import {
  type ChatToolInvocation,
  type ToolInvocationStatus,
} from "../../../stores";
import { useToolRuntime } from "../../../hooks/useToolRuntime";
import { getToolLabel, getToolDanger, renderToolSummary } from "../../../tools";
import { getEntityIconComponent } from "../../../utils/entityConfig";
import type { EntityType } from "@mythos/core";

interface ToolResultCardProps {
  messageId: string;
  tool: ChatToolInvocation;
}

function getStatusIcon(status: ToolInvocationStatus) {
  switch (status) {
    case "proposed":
      return null;
    case "accepted":
    case "executing":
      return <Loader2 className="w-3.5 h-3.5 text-mythos-accent-cyan animate-spin" />;
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
  return "border-mythos-text-muted/20 bg-mythos-bg-tertiary/50";
}

export function ToolResultCard({ messageId, tool }: ToolResultCardProps) {
  const { acceptTool, rejectTool, retryTool, cancelTool } = useToolRuntime();

  const args = (tool.args ?? {}) as Record<string, unknown>;
  const getArg = <T,>(key: string, fallback?: T): T | undefined =>
    (args[key] as T | undefined) ?? fallback;

  const isProposed = tool.status === "proposed";
  const isExecuting = tool.status === "accepted" || tool.status === "executing";
  const isFailed = tool.status === "failed";
  const isCanceled = tool.status === "canceled";
  const canRetry = isFailed || isCanceled;

  const danger = getToolDanger(tool.toolName);
  const label = getToolLabel(tool.toolName);
  const summary = renderToolSummary(tool.toolName, tool.args);
  const needsApproval = tool.needsApproval;

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
    return <FileText className="w-4 h-4" />;
  };

  // Get action button label based on tool type
  const getActionLabel = () => {
    // Saga unified agent tools
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
            {needsApproval && isProposed && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-mythos-accent-yellow/20 text-mythos-accent-yellow font-medium">
                Approval Required
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

      {/* Details preview */}
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
                className="h-full bg-mythos-accent-cyan transition-all"
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
                className="relative rounded-lg overflow-hidden border border-mythos-text-muted/20 bg-mythos-bg-tertiary group cursor-pointer"
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

      {/* Actions for proposed state */}
      {isProposed && (
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
          >
            <Check className="w-3 h-3" />
            {needsApproval ? "Approve" : getActionLabel()}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            className="flex-1 h-7 text-xs gap-1"
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
