/**
 * delete_document tool executor
 *
 * This tool executes on the server and requires confirmation.
 */

import type { DeleteDocumentArgs, DeleteDocumentResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const deleteDocumentExecutor: ToolDefinition<
  DeleteDocumentArgs,
  DeleteDocumentResult
> = {
  toolName: "delete_document",
  label: "Delete Document",
  requiresConfirmation: true,
  danger: "destructive",

  renderSummary: (args) => `Delete document ${args.documentId}`,

  execute: async (): Promise<ToolExecutionResult<DeleteDocumentResult>> => {
    return {
      success: false,
      error: "This tool executes on the server.",
    };
  },
};
