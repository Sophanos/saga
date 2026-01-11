/**
 * Editor tools for the Saga agent.
 *
 * These tools intentionally omit handlers so the client can collect
 * human input and submit tool results before continuing generation.
 */

import { tool } from "ai";
import { z } from "zod";
import { citationSchema } from "./citations";

/**
 * Rich option with label and description.
 */
const questionOptionSchema = z.object({
  id: z.string().describe("Unique identifier for this option"),
  label: z.string().describe("Display label"),
  description: z.string().optional().describe("Description shown below label"),
});

/**
 * Individual question in a research flow.
 */
const researchQuestionSchema = z.object({
  id: z.string().describe("Unique identifier for this question"),
  tabLabel: z.string().max(20).optional().describe("Short tab label (used when 2+ questions)"),
  question: z.string().describe("The full question text"),
  detail: z.string().optional().describe("Optional context or detail"),
  options: z.array(questionOptionSchema).optional().describe("Rich options with label + description"),
  required: z.boolean().optional().describe("Whether this question is required (default true)"),
});

/**
 * Unified ask_question tool.
 * UI adapts based on question count:
 * - 1 question: simple inline display
 * - 2+ questions: tabbed navigation with progress
 */
export const askQuestionTool = tool({
  description:
    "Ask the user one or more questions to gather information. For a single question, pass an array with one item. For related questions that should be answered together, pass multiple items - they will be shown as tabs.",
  inputSchema: z.object({
    title: z.string().optional().describe("Optional title (shown when 2+ questions)"),
    description: z.string().optional().describe("Optional description"),
    questions: z
      .array(researchQuestionSchema)
      .min(1)
      .max(10)
      .describe("Array of questions (1 or more)"),
    allowPartialSubmit: z.boolean().optional().describe("Allow submitting without answering all required questions"),
    submitLabel: z.string().optional().describe("Custom submit button label"),
  }),
});

export const writeContentTool = tool({
  description: "Propose a content change that requires user approval.",
  inputSchema: z.object({
    operation: z.enum(["replace_selection", "insert_at_cursor", "append_document"]),
    content: z.string().describe("The proposed content to insert"),
    format: z.enum(["plain", "markdown"]).optional(),
    rationale: z.string().optional().describe("Why this change improves the draft"),
    citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
  }),
});
