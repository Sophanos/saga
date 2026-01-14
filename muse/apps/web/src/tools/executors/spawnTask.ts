/**
 * spawn_task Tool Executor
 *
 * Auto-executed on backend. This is UI metadata only.
 */

import type { SpawnTaskArgs, SpawnTaskResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

const AGENT_LABELS: Record<string, string> = {
  research: "Research",
  analysis: "Analysis",
  writing: "Writing",
};

export const spawnTaskExecutor: ToolDefinition<SpawnTaskArgs, SpawnTaskResult> = {
  toolName: "spawn_task",
  label: "Sub-Agent Task",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => {
    const agentLabel = AGENT_LABELS[args.agent] ?? args.agent;
    return `${agentLabel}: ${args.title}`;
  },

  execute: async (): Promise<ToolExecutionResult<SpawnTaskResult>> => {
    // Auto-executed on backend - no client-side execution
    return {
      success: false,
      error: "This tool is auto-executed on the backend.",
    };
  },
};
