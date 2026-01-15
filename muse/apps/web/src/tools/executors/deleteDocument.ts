/**
 * delete_document tool executor
 *
 * Soft-deletes a document on the server and records an audit revision.
 */

import type { DeleteDocumentArgs, DeleteDocumentResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { api } from "../../../../../convex/_generated/api";

export const deleteDocumentExecutor: ToolDefinition<
  DeleteDocumentArgs,
  DeleteDocumentResult
> = {
  toolName: "delete_document",
  label: "Delete Document",
  requiresConfirmation: true,
  danger: "destructive",

  renderSummary: (args) => `Delete document ${args.documentId}`,

  execute: async (
    args,
    ctx
  ): Promise<ToolExecutionResult<DeleteDocumentResult>> => {
    if (!ctx.convex) {
      return { success: false, error: "Convex client is not available" };
    }

    try {
      const result = await ctx.convex.mutation(
        (api as any).documents.deleteDocument,
        { documentId: args.documentId as any, reason: args.reason }
      );
      return { success: true, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete document";
      return { success: false, error: message };
    }
  },
};
