import { useMemo, useCallback, useState } from "react";
import { useAction } from "convex/react";
import { cn, toast } from "@mythos/ui";
import { bg, text } from "@mythos/theme";
import { useBillingMode, useUsage, useUsagePercentage } from "../../../stores/billing";
import { useMythosStore } from "../../../stores";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export interface ChatUsageIndicatorProps {
  draft: string;
  variant?: "default" | "notion";
  className?: string;
  /** Thread ID for context-aware summarization */
  threadId?: string;
  /** Callback when thread is summarized */
  onSummarized?: (summary: string) => void;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

function resolveEstimateTone(estimatedTokens: number): "ok" | "warn" | "danger" {
  if (estimatedTokens >= 6_000) return "danger";
  if (estimatedTokens >= 3_000) return "warn";
  return "ok";
}

export function ChatUsageIndicator({
  draft,
  variant = "default",
  className,
  threadId,
  onSummarized,
}: ChatUsageIndicatorProps): JSX.Element {
  const billingMode = useBillingMode();
  const usage = useUsage();
  const usagePct = useUsagePercentage();
  const projectId = useMythosStore((s) => s.project.currentProject?.id);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Cast api to any to access generated actions
  const summarizeThread = useAction((api as any).ai?.summarizeThread?.summarizeThread);

  const estimatedTokens = useMemo(() => estimateTokens(draft), [draft]);
  const estimateTone = useMemo(() => resolveEstimateTone(estimatedTokens), [estimatedTokens]);

  // Show summarize button when context is high and we have a thread
  const showSummarize = threadId && estimateTone === "danger" && summarizeThread;

  const handleSummarize = useCallback(async () => {
    if (!threadId || !projectId || !summarizeThread) return;
    setIsSummarizing(true);
    try {
      const result = await summarizeThread({
        threadId,
        projectId: projectId as Id<"projects">,
        createNewThread: false,
      });
      if (result.summary) {
        toast.success(`Summarized ${result.originalMessageCount} messages`);
        onSummarized?.(result.summary);
      }
    } catch (err) {
      toast.error("Failed to summarize conversation");
      console.error("Summarize error:", err);
    } finally {
      setIsSummarizing(false);
    }
  }, [threadId, projectId, summarizeThread, onSummarized]);

  const usageLabel = useMemo(() => {
    if (billingMode === "byok") return "BYOK";
    if (usage.tokensIncluded === 0) return `${formatCompact(usage.tokensUsed)} tok`;
    return `${formatCompact(usage.tokensUsed)}/${formatCompact(usage.tokensIncluded)} tok`;
  }, [billingMode, usage.tokensIncluded, usage.tokensUsed]);

  const estimateLabel = useMemo(() => {
    if (!estimatedTokens) return null;
    return `~${formatCompact(estimatedTokens)} tok`;
  }, [estimatedTokens]);

  const chipClassName =
    variant === "notion"
      ? "h-7 px-2.5 rounded-md flex items-center gap-1 text-[11px]"
      : "h-6 px-2 rounded-md flex items-center gap-1 text-[11px]";

  const estimateStyle = useMemo(() => {
    if (estimateTone === "danger") {
      return { color: "#fca5a5", background: "rgba(239, 68, 68, 0.12)" };
    }
    if (estimateTone === "warn") {
      return { color: "#fbbf24", background: "rgba(245, 158, 11, 0.12)" };
    }
    return { color: text.secondary, background: bg.hover };
  }, [estimateTone]);

  return (
    <div className={cn("flex items-center gap-1", className)} data-testid="chat-usage">
      <div
        className={chipClassName}
        style={{ background: bg.hover, color: text.secondary }}
        title={billingMode === "byok" ? "Bring your own key" : "Monthly token usage"}
      >
        <span className="tabular-nums">{usageLabel}</span>
        {billingMode !== "byok" && usage.tokensIncluded > 0 ? (
          <span className="tabular-nums" style={{ color: text.muted }}>
            ({Math.round(usagePct)}%)
          </span>
        ) : null}
      </div>

      {estimateLabel ? (
        <div
          className={chipClassName}
          style={estimateStyle}
          title="Approximate message tokens (heuristic)"
        >
          <span className="tabular-nums">{estimateLabel}</span>
        </div>
      ) : null}

      {showSummarize ? (
        <button
          onClick={handleSummarize}
          disabled={isSummarizing}
          className={cn(
            chipClassName,
            "cursor-pointer hover:opacity-80 transition-opacity",
            isSummarizing && "opacity-50 cursor-wait"
          )}
          style={{
            background: "rgba(245, 158, 11, 0.2)",
            color: "#fbbf24",
            border: "none",
          }}
          title="Summarize conversation to reduce context size"
        >
          {isSummarizing ? "..." : "Summarize"}
        </button>
      ) : null}
    </div>
  );
}
