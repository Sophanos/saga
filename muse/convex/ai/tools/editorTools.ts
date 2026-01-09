/**
 * Editor tools for the Saga agent.
 *
 * These tools intentionally omit handlers so the client can collect
 * human input and submit tool results before continuing generation.
 */

import { tool } from "ai";
import { z } from "zod";

export const askQuestionTool = tool({
  description: "Ask the user a specific question to continue the task.",
  inputSchema: z.object({
    question: z.string().describe("The question to ask the user"),
    detail: z.string().optional().describe("Optional context or reason"),
    responseType: z.enum(["text", "choice"]).optional(),
    choices: z.array(z.string()).optional().describe("Choices when responseType is 'choice'"),
  }),
});

export const writeContentTool = tool({
  description: "Propose a content change that requires user approval.",
  inputSchema: z.object({
    operation: z.enum(["replace_selection", "insert_at_cursor", "append_document"]),
    content: z.string().describe("The proposed content to insert"),
    format: z.enum(["plain", "markdown"]).optional(),
    rationale: z.string().optional().describe("Why this change improves the draft"),
  }),
});
