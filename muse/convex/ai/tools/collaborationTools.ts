/**
 * Collaboration Tools - Document collaboration and version history
 *
 * Provides AI agent access to collaboration features:
 * - Version history viewing
 * - Comments (view and add)
 * - User search for @mentions
 * - Document deletion
 */

import { tool } from "ai";
import { z } from "zod";

export const viewVersionHistoryTool = tool({
  description: "View the revision history of a document. Returns a list of versions with timestamps and optional summaries.",
  inputSchema: z.object({
    documentId: z.string().describe("The document ID to get version history for"),
    limit: z.number().min(1).max(50).optional().describe("Max versions to return (default: 25)"),
    cursor: z.string().optional().describe("Pagination cursor for fetching more results"),
  }),
});

export const viewCommentsTool = tool({
  description: "List comments on a document. Returns comments with author info, content, and selection ranges.",
  inputSchema: z.object({
    documentId: z.string().describe("The document ID to get comments for"),
    limit: z.number().min(1).max(100).optional().describe("Max comments to return (default: 50)"),
    cursor: z.string().optional().describe("Pagination cursor for fetching more results"),
  }),
});

export const addCommentTool = tool({
  description: "Add a comment to a document. Requires user approval before execution.",
  inputSchema: z.object({
    documentId: z.string().describe("The document ID to add a comment to"),
    content: z.string().min(1).describe("The comment text"),
    selectionRange: z
      .object({
        from: z.number().describe("Start position of the selection"),
        to: z.number().describe("End position of the selection"),
      })
      .optional()
      .describe("Optional text selection range the comment refers to"),
  }),
});

export const searchUsersTool = tool({
  description: "Search for project members to @mention in comments or content. Returns matching users with name and email.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search query (name or email)"),
    limit: z.number().min(1).max(20).optional().describe("Max users to return (default: 10)"),
  }),
});

export const deleteDocumentTool = tool({
  description: "Soft-delete a document. This is a destructive action that requires user approval.",
  inputSchema: z.object({
    documentId: z.string().describe("The document ID to delete"),
    reason: z.string().optional().describe("Optional reason for deletion"),
  }),
});
