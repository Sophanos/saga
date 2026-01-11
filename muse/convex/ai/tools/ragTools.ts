/**
 * RAG Tools - Agent-invocable context retrieval
 *
 * Generic search tools that work across any project type.
 * Use search_context with scope parameter instead of domain-specific tools.
 */

import { tool } from "ai";
import { z } from "zod";

export const searchContextTool = tool({
  description: "Search project documents, entities, and memories. Use scope to filter by content type.",
  inputSchema: z.object({
    query: z.string().describe("What to search for"),
    scope: z.enum(["all", "documents", "entities", "memories"]).optional().describe("Limit search to specific content type"),
    limit: z.number().min(1).max(20).optional().describe("Max results (default: 5)"),
  }),
});

export const readDocumentTool = tool({
  description: "Read full content of a document. Use after search_context to get complete text instead of preview.",
  inputSchema: z.object({
    documentId: z.string().describe("Document ID from search results"),
  }),
});

export const getEntityTool = tool({
  description: "Get full details of an entity including relationships from the Project Graph.",
  inputSchema: z.object({
    entityId: z.string().describe("Entity ID"),
    includeRelationships: z.boolean().optional().describe("Include Project Graph connections"),
  }),
});
