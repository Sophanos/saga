/**
 * RAG Tools - Agent-invocable context retrieval
 */

import { tool } from "ai";
import { z } from "zod";

export const searchContextTool = tool({
  description: "Search project documents, entities, and memories. Use when you need specific information about the story, characters, world, or past decisions.",
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

export const searchChaptersTool = tool({
  description: "Search chapters and scenes in the manuscript by content or metadata.",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    type: z.enum(["chapter", "scene", "note", "all"]).optional().describe("Filter by document type"),
  }),
});

export const searchWorldTool = tool({
  description: "Search worldbuilding content: locations, factions, magic systems, cultures.",
  inputSchema: z.object({
    query: z.string().describe("What to search for"),
    category: z.enum(["location", "faction", "magic_system", "concept", "all"]).optional(),
  }),
});

export const getEntityTool = tool({
  description: "Get full details of a character, location, or other entity including relationships.",
  inputSchema: z.object({
    entityId: z.string().describe("Entity ID"),
    includeRelationships: z.boolean().optional().describe("Include World Graph connections"),
  }),
});
