/**
 * Artifact Tools - Agent-invocable artifact operations
 *
 * Tools for creating, updating, and controlling artifacts from the agent runtime.
 * Server-executed: agent calls → runtime executes → streams result to client.
 */

import { tool } from "ai";
import { z } from "zod";

// Shared schemas
const artifactKeySchema = z.string().regex(/^[a-z0-9:_-]+$/i).describe("Unique artifact identifier");
const artifactFormatSchema = z.enum(["json", "markdown", "plain"]).describe("Content format");
const artifactTypeSchema = z.enum([
  "prose", "dialogue", "lore", "code", "map", "table", "diagram", "timeline", "chart", "outline", "entityCard",
]).describe("Artifact content type");
const focusIdSchema = z.string().min(1).describe("Element ID within artifact to focus");

// Define parameter schemas first (for type inference)
const artifactToolParameters = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().describe("Artifact title"),
    type: artifactTypeSchema,
    format: artifactFormatSchema.optional().default("json"),
    artifactKey: artifactKeySchema.optional(),
    content: z.string().optional().describe("Initial content (markdown/plain)"),
    envelope: z.any().optional().describe("Full JSON envelope for complex types"),
    open: z.boolean().optional().default(true).describe("Open artifact panel"),
    setActive: z.boolean().optional().default(true).describe("Set as active artifact"),
    focusId: focusIdSchema.optional(),
  }),
  z.object({
    action: z.literal("update"),
    artifactKey: artifactKeySchema,
    patch: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      format: artifactFormatSchema.optional(),
      focusId: focusIdSchema.optional(),
    }),
  }),
  z.object({
    action: z.literal("apply_op"),
    artifactKey: artifactKeySchema,
    op: z.any().describe("Artifact operation (table.cell.update, diagram.node.upsert, etc.)"),
  }),
  z.object({
    action: z.literal("remove"),
    artifactKey: artifactKeySchema,
  }),
]);

export type ArtifactToolArgs = z.infer<typeof artifactToolParameters>;

export const artifactTool = tool({
  description: "Create or modify artifacts. Use action='create' for new artifacts, 'update' for patches, 'apply_op' for structured operations.",
  inputSchema: artifactToolParameters,
});

// Stage tool parameters
const artifactStageParameters = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open_panel"),
    mode: z.enum(["side", "floating"]).optional().default("side"),
    artifactKey: artifactKeySchema.optional(),
  }),
  z.object({
    action: z.literal("close_panel"),
  }),
  z.object({
    action: z.literal("set_active"),
    artifactKey: artifactKeySchema,
  }),
  z.object({
    action: z.literal("focus"),
    artifactKey: artifactKeySchema,
    focusId: focusIdSchema,
  }),
  z.object({
    action: z.literal("compare"),
    leftKey: artifactKeySchema,
    rightKey: artifactKeySchema,
    mode: z.enum(["side-by-side", "before-after", "inline"]).optional().default("side-by-side"),
  }),
  z.object({
    action: z.literal("exit_compare"),
  }),
]);

export type ArtifactStageArgs = z.infer<typeof artifactStageParameters>;

export const artifactStageTool = tool({
  description: "Control artifact panel UI: open/close, set active, focus elements, or compare artifacts.",
  inputSchema: artifactStageParameters,
});

// Diagram tool parameters
const artifactDiagramParameters = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().describe("Diagram title"),
    nodes: z.array(z.object({
      nodeId: z.string().optional(),
      title: z.string(),
      subtitle: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      nodeKind: z.enum(["entity", "note", "group"]).optional().default("entity"),
      entityId: z.string().optional(),
    })).describe("Diagram nodes"),
    edges: z.array(z.object({
      edgeId: z.string().optional(),
      source: z.string().describe("Source node ID"),
      target: z.string().describe("Target node ID"),
      label: z.string().optional(),
      kind: z.string().optional(),
    })).optional().default([]).describe("Diagram edges"),
  }),
  z.object({
    action: z.literal("upsert_node"),
    artifactKey: artifactKeySchema,
    nodeId: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    nodeKind: z.enum(["entity", "note", "group"]).optional(),
    entityId: z.string().optional(),
  }),
  z.object({
    action: z.literal("move_node"),
    artifactKey: artifactKeySchema,
    nodeId: z.string(),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    action: z.literal("add_edge"),
    artifactKey: artifactKeySchema,
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    kind: z.string().optional(),
  }),
  z.object({
    action: z.literal("update_edge"),
    artifactKey: artifactKeySchema,
    edgeId: z.string(),
    label: z.string().optional(),
    kind: z.string().optional(),
  }),
]);

export type ArtifactDiagramArgs = z.infer<typeof artifactDiagramParameters>;

export const artifactDiagramTool = tool({
  description: "Create or modify diagrams with nodes and edges. For Project Graph visualization.",
  inputSchema: artifactDiagramParameters,
});

// Table tool parameters
const artifactTableParameters = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().describe("Table title"),
    columns: z.array(z.object({
      columnId: z.string().optional(),
      label: z.string(),
      valueType: z.enum(["text", "number", "boolean", "date", "enum", "entity"]).default("text"),
      enumOptions: z.array(z.string()).optional(),
    })).describe("Table columns"),
    rows: z.array(z.object({
      rowId: z.string().optional(),
      cells: z.record(z.any()).describe("Column ID → cell value"),
    })).optional().default([]).describe("Initial rows"),
  }),
  z.object({
    action: z.literal("add_row"),
    artifactKey: artifactKeySchema,
    rowId: z.string().optional(),
    cells: z.record(z.any()),
    afterRowId: z.string().optional().describe("Insert after this row"),
  }),
  z.object({
    action: z.literal("update_cell"),
    artifactKey: artifactKeySchema,
    rowId: z.string(),
    columnId: z.string(),
    value: z.any(),
  }),
  z.object({
    action: z.literal("remove_rows"),
    artifactKey: artifactKeySchema,
    rowIds: z.array(z.string()),
  }),
  z.object({
    action: z.literal("reorder_rows"),
    artifactKey: artifactKeySchema,
    rowIds: z.array(z.string()).describe("New row order"),
  }),
]);

export type ArtifactTableArgs = z.infer<typeof artifactTableParameters>;

export const artifactTableTool = tool({
  description: "Create or modify tables with typed columns and rows.",
  inputSchema: artifactTableParameters,
});

// Timeline tool parameters
const artifactTimelineParameters = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().describe("Timeline title"),
    groups: z.array(z.object({
      groupId: z.string().optional(),
      label: z.string(),
      kind: z.string().optional(),
      entityId: z.string().optional(),
    })).optional().default([]).describe("Timeline groups/lanes"),
    items: z.array(z.object({
      itemId: z.string().optional(),
      start: z.string().describe("ISO date or relative (e.g., 'Day 1')"),
      end: z.string().optional(),
      content: z.string().describe("Event description"),
      groupId: z.string().optional(),
    })).describe("Timeline events"),
  }),
  z.object({
    action: z.literal("upsert_item"),
    artifactKey: artifactKeySchema,
    itemId: z.string().optional(),
    start: z.string(),
    end: z.string().optional(),
    content: z.string(),
    groupId: z.string().optional(),
  }),
  z.object({
    action: z.literal("update_item"),
    artifactKey: artifactKeySchema,
    itemId: z.string(),
    start: z.string().optional(),
    end: z.string().optional(),
    content: z.string().optional(),
    groupId: z.string().optional(),
  }),
]);

export type ArtifactTimelineArgs = z.infer<typeof artifactTimelineParameters>;

export const artifactTimelineTool = tool({
  description: "Create or modify timelines with groups and items. For story events, project milestones.",
  inputSchema: artifactTimelineParameters,
});

// Prose tool parameters
const artifactProseParameters = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().describe("Content title"),
    type: z.enum(["prose", "dialogue", "lore", "code", "map"]).default("prose"),
    markdown: z.string().describe("Content in markdown format"),
  }),
  z.object({
    action: z.literal("replace_block"),
    artifactKey: artifactKeySchema,
    blockId: z.string(),
    markdown: z.string(),
  }),
]);

export type ArtifactProseArgs = z.infer<typeof artifactProseParameters>;

export const artifactProseTool = tool({
  description: "Create or modify prose content (narrative, dialogue, lore, code).",
  inputSchema: artifactProseParameters,
});

// Link tool parameters
const artifactLinkParameters = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("project"),
    projectId: z.string(),
  }),
  z.object({
    target: z.literal("document"),
    projectId: z.string(),
    documentId: z.string(),
    focusId: focusIdSchema.optional(),
  }),
  z.object({
    target: z.literal("entity"),
    projectId: z.string(),
    entityId: z.string(),
  }),
  z.object({
    target: z.literal("artifact"),
    projectId: z.string(),
    artifactKey: artifactKeySchema,
    focusId: focusIdSchema.optional(),
  }),
]);

export type ArtifactLinkArgs = z.infer<typeof artifactLinkParameters>;

export const artifactLinkTool = tool({
  description: "Generate deep links to projects, documents, entities, or artifacts.",
  inputSchema: artifactLinkParameters,
});
