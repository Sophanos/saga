/**
 * Evidence tools for image regions + links.
 */

import { tool } from "ai";
import { z } from "zod";

const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const rectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const regionCreateRectSchema = z.object({
  type: z.literal("region.create"),
  assetId: z.string(),
  shape: z.literal("rect"),
  rect: rectSchema,
  selector: z.string().optional(),
  label: z.string().optional(),
  note: z.string().optional(),
});

const regionCreatePolygonSchema = z.object({
  type: z.literal("region.create"),
  assetId: z.string(),
  shape: z.literal("polygon"),
  polygon: z.array(pointSchema).min(3),
  selector: z.string(),
  label: z.string().optional(),
  note: z.string().optional(),
});

const regionDeleteSchema = z.object({
  type: z.literal("region.delete"),
  regionId: z.string(),
});

const linkCreateSchema = z.object({
  type: z.literal("link.create"),
  assetId: z.string(),
  regionId: z.string().optional(),
  targetType: z.enum(["document", "entity", "relationship", "memory"]),
  targetId: z.string(),
  claimPath: z.string().optional(),
  relation: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  note: z.string().optional(),
});

const linkDeleteSchema = z.object({
  type: z.literal("link.delete"),
  linkId: z.string(),
});

const evidenceOpSchema = z.union([
  regionCreateRectSchema,
  regionCreatePolygonSchema,
  regionDeleteSchema,
  linkCreateSchema,
  linkDeleteSchema,
]);

export const evidenceMutationTool = tool({
  description:
    "Propose evidence operations for image regions and links. Use for image-based citations and provenance (requires approval).",
  inputSchema: z.object({
    ops: z.array(evidenceOpSchema).min(1),
    rationale: z.string().optional(),
  }),
});
