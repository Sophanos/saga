/**
 * generate_content tool definition
 */

import { tool } from "https://esm.sh/ai@3.4.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { contentTypeSchema, lengthSchema, type ToolExecuteResult } from "./types.ts";

export const generateContentParameters = z.object({
  contentType: contentTypeSchema.describe("Type of content to generate"),
  subject: z.string().describe("What the content is about"),
  tone: z.string().optional().describe("Desired tone (dark, humorous, dramatic, mysterious, etc.)"),
  length: lengthSchema.optional().describe("Desired length of the content"),
});

export type GenerateContentArgs = z.infer<typeof generateContentParameters>;

export const generateContentTool = tool({
  description: "Generate creative content like backstories, descriptions, dialogue, or scene drafts",
  parameters: generateContentParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    return {
      toolName: "generate_content",
      proposal: args,
      message: `Generating ${args.contentType} for: ${args.subject}`,
    };
  },
});
