import { z } from "zod";

export const artifactTypeSchema = z.enum([
  "prose",
  "table",
  "diagram",
  "timeline",
  "chart",
  "outline",
  "entityCard",
]);

const idSchema = z
  .string()
  .regex(/^[a-z0-9:_-]+$/i, "Invalid id format");

const isoDateTimeSchema = z.string();
const storyTimeSchema = z
  .string()
  .regex(/^Y\d+(M\d+)?(D\d+)?$/, "Invalid story time format");

const provenanceSchema = z
  .object({
    createdBy: z.enum(["user", "ai"]),
    model: z.string().optional(),
    promptId: z.string().optional(),
    seedArtifactId: z.string().optional(),
  })
  .optional();

const templateSchema = z
  .object({
    templateId: idSchema,
    templateVersion: z.string().optional(),
    templateInputs: z.record(z.unknown()).optional(),
  })
  .optional();

const artifactReferenceSchema = z.object({
  artifactId: idSchema,
  elementId: idSchema.optional(),
  label: z.string().optional(),
});

const iterationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number(),
  artifactVersion: z.string().optional(),
});

const indexSchema = z
  .object({
    entityIds: z.array(idSchema).optional(),
    tags: z.array(z.string()).optional(),
  })
  .optional();

export const cellValueSchema = z.union([
  z.object({ t: z.literal("text"), v: z.string() }),
  z.object({ t: z.literal("number"), v: z.number() }),
  z.object({ t: z.literal("bool"), v: z.boolean() }),
  z.object({ t: z.literal("date"), v: z.string() }),
  z.object({ t: z.literal("enum"), v: z.string() }),
  z.object({ t: z.literal("entity"), v: z.string() }),
]);

export const tableColumnSchema = z.object({
  columnId: idSchema,
  label: z.string(),
  valueType: z.enum(["text", "number", "bool", "date", "enum", "entity"]),
  enumOptions: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional(),
  width: z.number().optional(),
  pinned: z.enum(["left", "right"]).optional(),
});

export const tableRowSchema = z.object({
  rowId: idSchema,
  entityId: idSchema.optional(),
  cells: z.record(cellValueSchema),
});

export const tableDataSchema = z.object({
  columnsById: z.record(tableColumnSchema),
  columnOrder: z.array(idSchema),
  rowsById: z.record(tableRowSchema),
  rowOrder: z.array(idSchema),
});

export const diagramNodeSchema = z.object({
  nodeId: idSchema,
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z
    .object({
      nodeKind: z.enum(["entity", "note", "group"]),
      entityId: idSchema.optional(),
      title: z.string(),
      subtitle: z.string().optional(),
      badges: z.array(z.string()).optional(),
      status: z.string().optional(),
    })
    .catchall(z.unknown()),
  parentNodeId: idSchema.optional(),
});

export const diagramEdgeSchema = z.object({
  edgeId: idSchema,
  type: z.string(),
  source: idSchema,
  target: idSchema,
  data: z
    .object({
      relationshipId: idSchema.optional(),
      kind: z
        .enum(["ally", "enemy", "mentor", "family", "romance", "rival", "power"])
        .optional(),
      label: z.string().optional(),
      strength: z.number().optional(),
    })
    .optional(),
});

export const diagramDataSchema = z.object({
  nodesById: z.record(diagramNodeSchema),
  nodeOrder: z.array(idSchema),
  edgesById: z.record(diagramEdgeSchema),
  edgeOrder: z.array(idSchema),
  relationshipsById: z
    .record(
      z.object({
        relationshipId: idSchema,
        a: idSchema,
        b: idSchema,
        kind: z.string(),
        notes: z.string().optional(),
      })
    )
    .optional(),
});

export const timelineGroupSchema = z.object({
  groupId: idSchema,
  label: z.string(),
  kind: z.enum(["plotline", "character", "faction"]),
  entityId: idSchema.optional(),
});

export const timelineItemSchema = z.object({
  itemId: idSchema,
  start: z.string(),
  storyTime: storyTimeSchema.optional(),
  end: z.string().optional(),
  content: z.string(),
  groupId: idSchema.optional(),
  entityIds: z.array(idSchema).optional(),
  editable: z
    .union([
      z.boolean(),
      z.object({
        updateTime: z.boolean().optional(),
        updateGroup: z.boolean().optional(),
        remove: z.boolean().optional(),
      }),
    ])
    .optional(),
});

export const timelineDataSchema = z.object({
  groupsById: z.record(timelineGroupSchema),
  groupOrder: z.array(idSchema),
  itemsById: z.record(timelineItemSchema),
  itemOrder: z.array(idSchema),
});

export const proseBlockSchema = z.object({
  blockId: idSchema,
  kind: z.enum(["heading", "paragraph", "list", "quote", "code"]),
  markdown: z.string(),
});

export const proseDataSchema = z.object({
  blocksById: z.record(proseBlockSchema),
  blockOrder: z.array(idSchema),
});

export const outlineItemSchema = z.object({
  itemId: idSchema,
  parentId: idSchema.optional(),
  title: z.string(),
  summary: z.string().optional(),
  entityIds: z.array(idSchema).optional(),
});

export const outlineDataSchema = z.object({
  itemsById: z.record(outlineItemSchema),
  childrenByParentId: z.record(z.array(idSchema)),
});

export const entityCardDataSchema = z.object({
  entityId: idSchema,
  displayFields: z.record(z.unknown()).optional(),
  imageUrl: z.string().optional(),
  relatedEntityIds: z.array(idSchema).optional(),
});

export const pacingPointSchema = z.object({
  pointId: idSchema,
  sceneId: idSchema.optional(),
  chapterId: idSchema.optional(),
  x: z.number(),
  tension: z.number(),
  label: z.string().optional(),
});

export const pacingChartDataSchema = z.object({
  chartKind: z.literal("pacing"),
  pointsById: z.record(pacingPointSchema),
  pointOrder: z.array(idSchema),
});

export const sankeyNodeSchema = z.object({
  nodeId: idSchema,
  entityId: idSchema.optional(),
  label: z.string(),
});

export const sankeyLinkSchema = z.object({
  linkId: idSchema,
  sourceId: idSchema,
  targetId: idSchema,
  value: z.number(),
  label: z.string().optional(),
});

export const influenceSankeyDataSchema = z.object({
  chartKind: z.literal("influenceSankey"),
  nodesById: z.record(sankeyNodeSchema),
  nodeOrder: z.array(idSchema),
  linksById: z.record(sankeyLinkSchema),
  linkOrder: z.array(idSchema),
});

export const chartDataSchema = z.discriminatedUnion("chartKind", [
  pacingChartDataSchema,
  influenceSankeyDataSchema,
]);

export const baseArtifactEnvelopeSchema = z.object({
  artifactId: idSchema,
  type: artifactTypeSchema,
  schemaVersion: z.literal("0.1"),
  title: z.string(),
  description: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  rev: z.number(),
  data: z.unknown(),
  view: z.unknown().optional(),
  viewByUser: z.record(z.unknown()).optional(),
  index: indexSchema,
  provenance: provenanceSchema,
  template: templateSchema,
  references: z.array(artifactReferenceSchema).optional(),
  iterationHistory: z.array(iterationMessageSchema).optional(),
});

export const artifactEnvelopeByTypeSchema = z.discriminatedUnion("type", [
  baseArtifactEnvelopeSchema.extend({ type: z.literal("prose"), data: proseDataSchema }),
  baseArtifactEnvelopeSchema.extend({ type: z.literal("table"), data: tableDataSchema }),
  baseArtifactEnvelopeSchema.extend({ type: z.literal("diagram"), data: diagramDataSchema }),
  baseArtifactEnvelopeSchema.extend({ type: z.literal("timeline"), data: timelineDataSchema }),
  baseArtifactEnvelopeSchema.extend({ type: z.literal("chart"), data: chartDataSchema }),
  baseArtifactEnvelopeSchema.extend({ type: z.literal("outline"), data: outlineDataSchema }),
  baseArtifactEnvelopeSchema.extend({ type: z.literal("entityCard"), data: entityCardDataSchema }),
]);

export const artifactEnvelopeSchema = baseArtifactEnvelopeSchema;

export type ArtifactEnvelope = z.infer<typeof artifactEnvelopeSchema>;
export type ArtifactEnvelopeByType = z.infer<typeof artifactEnvelopeByTypeSchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export function parseArtifactEnvelope(input: unknown): ArtifactEnvelopeByType {
  return artifactEnvelopeByTypeSchema.parse(input);
}
