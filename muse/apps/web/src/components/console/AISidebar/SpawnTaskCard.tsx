/**
 * SpawnTaskCard
 *
 * Renders spawn_task tool result as an expandable artifact.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Search, BarChart3, Pen } from "lucide-react";
import { cn } from "@mythos/ui";
import type { SpawnTaskArgs, SpawnTaskResult, SubAgentType } from "@mythos/agent-protocol";

interface SpawnTaskCardProps {
  args: SpawnTaskArgs;
  result?: SpawnTaskResult;
  isExecuting?: boolean;
  className?: string;
}

function getAgentIcon(agent: SubAgentType) {
  switch (agent) {
    case "research":
      return <Search className="w-3.5 h-3.5" />;
    case "analysis":
      return <BarChart3 className="w-3.5 h-3.5" />;
    case "writing":
      return <Pen className="w-3.5 h-3.5" />;
  }
}

function getAgentLabel(agent: SubAgentType) {
  switch (agent) {
    case "research":
      return "Research Agent";
    case "analysis":
      return "Analysis Agent";
    case "writing":
      return "Writing Agent";
  }
}

function getAgentColor(agent: SubAgentType) {
  switch (agent) {
    case "research":
      return "bg-mythos-accent-blue/20 text-mythos-accent-blue";
    case "analysis":
      return "bg-mythos-accent-purple/20 text-mythos-accent-purple";
    case "writing":
      return "bg-mythos-accent-green/20 text-mythos-accent-green";
  }
}

export function SpawnTaskCard({
  args,
  result,
  isExecuting,
  className,
}: SpawnTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasOutput = result?.output && result.output.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        "border-mythos-border-subtle bg-mythos-bg-secondary/50",
        className
      )}
    >
      {/* Header - clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-mythos-bg-hover transition-colors"
      >
        {/* Expand icon */}
        <div className="text-mythos-text-muted">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>

        {/* Agent badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
            getAgentColor(args.agent)
          )}
        >
          {getAgentIcon(args.agent)}
          {getAgentLabel(args.agent)}
        </div>

        {/* Title */}
        <span className="flex-1 text-xs text-mythos-text-primary truncate">
          {args.title}
        </span>

        {/* Status */}
        {isExecuting && (
          <span className="text-[10px] text-mythos-accent-primary animate-pulse">
            Running...
          </span>
        )}
        {hasOutput && !isExecuting && (
          <span className="text-[10px] text-mythos-accent-green">Done</span>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-mythos-border-subtle">
          {/* Instructions */}
          <div className="mb-2">
            <span className="text-[10px] text-mythos-text-muted uppercase tracking-wider">
              Instructions
            </span>
            <p className="text-xs text-mythos-text-secondary mt-0.5 line-clamp-3">
              {args.instructions}
            </p>
          </div>

          {/* Output */}
          {hasOutput && (
            <div>
              <span className="text-[10px] text-mythos-text-muted uppercase tracking-wider">
                Output
              </span>
              <div className="mt-1 p-2 rounded bg-mythos-bg-tertiary max-h-48 overflow-y-auto">
                <p className="text-xs text-mythos-text-primary whitespace-pre-wrap">
                  {result.output}
                </p>
              </div>
            </div>
          )}

          {/* Artifacts */}
          {result?.artifacts && result.artifacts.length > 0 && (
            <div className="mt-2">
              <span className="text-[10px] text-mythos-text-muted uppercase tracking-wider">
                Artifacts ({result.artifacts.length})
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {result.artifacts.map((artifact, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-mythos-bg-tertiary text-mythos-text-secondary"
                  >
                    {artifact.title || artifact.kind}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
