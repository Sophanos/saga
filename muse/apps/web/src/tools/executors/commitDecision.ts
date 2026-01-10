/**
 * commit_decision tool executor
 *
 * Records a canon decision in project memory via ai-saga execute_tool.
 */

import type {
  CommitDecisionArgs,
  CommitDecisionResult,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { callEdgeFunction, ApiError } from "../../services/api-client";

// =============================================================================
// Types
// =============================================================================

interface SagaExecuteToolRequest {
  kind: "execute_tool";
  toolName: string;
  input: unknown;
  projectId: string;
}

interface SagaExecuteToolResponse {
  toolName: string;
  result: CommitDecisionResult;
}

// =============================================================================
// Executor
// =============================================================================

export const commitDecisionExecutor: ToolDefinition<CommitDecisionArgs, CommitDecisionResult> = {
  toolName: "commit_decision",
  label: "Commit Decision",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const decision = args.decision ?? "";
    const preview = decision.length > 120 ? `${decision.slice(0, 120)}...` : decision;
    return `Commit decision: "${preview}"`;
  },

  validate: (args) => {
    if (!args.decision || args.decision.trim().length === 0) {
      return { valid: false, error: "Decision is required" };
    }
    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<CommitDecisionResult>> => {
    try {
      if (!ctx.projectId) {
        return { success: false, error: "Project ID is required for commit_decision" };
      }

      if (!ctx.apiKey) {
        return { success: false, error: "API key is required for commit_decision" };
      }

      const request: SagaExecuteToolRequest = {
        kind: "execute_tool",
        toolName: "commit_decision",
        projectId: ctx.projectId,
        input: {
          decision: args.decision,
          category: args.category,
          rationale: args.rationale,
          entityIds: args.entityIds,
          documentId: args.documentId,
          confidence: args.confidence,
          pinned: args.pinned,
        },
      };

      const response = await callEdgeFunction<SagaExecuteToolRequest, SagaExecuteToolResponse>(
        "ai-saga",
        request,
        { apiKey: ctx.apiKey, signal: ctx.signal }
      );

      return { success: true, result: response.result };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
          ? error.message
          : "Failed to commit decision";
      return { success: false, error: message };
    }
  },
};
