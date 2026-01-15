/**
 * add_comment tool executor
 *
 * Adds a comment to a document in Convex.
 */

import type { AddCommentArgs, AddCommentResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { api } from "../../../../../convex/_generated/api";

export const addCommentExecutor: ToolDefinition<AddCommentArgs, AddCommentResult> = {
  toolName: "add_comment",
  label: "Add Comment",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => `Add comment on ${args.documentId}`,

  execute: async (
    args,
    ctx
  ): Promise<ToolExecutionResult<AddCommentResult>> => {
    if (!ctx.convex) {
      return { success: false, error: "Convex client is not available" };
    }

    try {
      const result = await ctx.convex.mutation(
        (api as any).comments.add,
        {
          projectId: ctx.projectId as any,
          documentId: args.documentId as any,
          content: args.content,
          selectionRange: args.selectionRange,
        }
      );
      return { success: true, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add comment";
      return { success: false, error: message };
    }
  },
};
