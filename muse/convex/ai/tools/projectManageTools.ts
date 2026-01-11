/**
 * Project Management Tools
 *
 * Unified entry point for project setup flows.
 */

import { tool } from "ai";
import { z } from "zod";

const detailLevelSchema = z.enum(["minimal", "standard", "detailed"]);

const bootstrapSchema = z.object({
  action: z.literal("bootstrap"),
  description: z.string().min(10).describe("High-level story or world description"),
  seed: z.boolean().default(true).describe("Whether to persist starter entities/relationships (default true)"),
  genre: z.string().optional().describe("Optional genre hint (e.g., fantasy, sci-fi)"),
  entityCount: z.number().min(3).max(50).optional().describe("Target number of entities to generate (3-50)"),
  detailLevel: detailLevelSchema.optional().describe("How detailed the generation should be"),
  includeOutline: z.boolean().optional().describe("Whether to include a story outline"),
  skipEntityTypes: z.array(z.string()).optional().describe("Entity types to skip during persistence"),
});

const restructureSchema = z.object({
  action: z.literal("restructure"),
  changes: z
    .array(
      z.union([
        z.object({
          op: z.literal("rename_type"),
          from: z.string().min(1),
          to: z.string().min(1),
        }),
        z.object({
          op: z.literal("add_field"),
          type: z.string().min(1),
          field: z.string().min(1),
        }),
      ])
    )
    .min(1),
});

const pivotSchema = z.object({
  action: z.literal("pivot"),
  toTemplate: z.string().min(1),
  mappings: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })).optional(),
  unmappedContent: z.enum(["archive", "discard"]).optional(),
});

export const projectManageTool = tool({
  description:
    "Unified project setup tool. Bootstrap always generates template structure. Ask user (ask_question) whether they want structure + starter content (seed:true) or structure only (seed:false). Note: restructure/pivot may return not_implemented.",
  inputSchema: z.discriminatedUnion("action", [bootstrapSchema, restructureSchema, pivotSchema]),
});
