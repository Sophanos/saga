/**
 * view_comments tool executor
 *
 * Loads document comments from Convex.
 */

import type { ViewCommentsArgs, ViewCommentsResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { api } from "../../../../../convex/_generated/api";

export const viewCommentsExecutor: ToolDefinition<ViewCommentsArgs, ViewCommentsResult> = {
  toolName: "view_comments",
  label: "View Comments",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => `View comments for ${args.documentId}`,

  execute: async (
    args,
    ctx
  ): Promise<ToolExecutionResult<ViewCommentsResult>> => {
    if (!ctx.convex) {
      return { success: false, error: "Convex client is not available" };
    }

    try {
      const result = await ctx.convex.query(
        (api as any).comments.listByDocument,
        {
          projectId: ctx.projectId as any,
          documentId: args.documentId as any,
          limit: args.limit,
          cursor: args.cursor,
        }
      );
      return { success: true, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load comments";
      return { success: false, error: message };
    }
  },
};
