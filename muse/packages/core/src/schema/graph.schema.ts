import { z } from "zod";

// Property value schema (recursive)
const literalSchema = z.union([z.string(), z.number(), z.boolean()]);
type Literal = z.infer<typeof literalSchema>;
type PropertyValue = Literal | Literal[] | { [key: string]: PropertyValue };
export const propertyValueSchema: z.ZodType<PropertyValue> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(z.string()),
    z.record(propertyValueSchema),
  ])
);

// Mention
export const mentionSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  positionStart: z.number().int().min(0),
  positionEnd: z.number().int().min(0),
  context: z.string(),
  timestamp: z.coerce.date(),
});

// Base graph entity (template-agnostic)
export const graphEntitySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Entity name is required"),
  aliases: z.array(z.string()).default([]),
  type: z.string(),
  properties: z.record(propertyValueSchema).default({}),
  mentions: z.array(mentionSchema).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  notes: z.string().optional(),
});

// Base graph relationship (template-agnostic)
export const graphRelationshipSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  bidirectional: z.boolean().default(false),
  strength: z.number().min(1).max(10).optional(),
  metadata: z.record(propertyValueSchema).optional(),
  notes: z.string().optional(),
  createdAt: z.coerce.date(),
});
