/**
 * Planning tools for Saga agent.
 *
 * Claude Code style: agent manages full todo state.
 * Each write_todos call replaces the previous list.
 */

import { tool } from "ai";
import { z } from "zod";

// =============================================================================
// Todo Schema (Claude Code style)
// =============================================================================

const todoStatusSchema = z.enum(["pending", "in_progress", "completed"]);

const todoSchema = z.object({
  id: z.string().describe("Stable todo identifier"),
  label: z.string().describe("Short todo label"),
  description: z.string().optional().describe("Optional detail"),
  status: todoStatusSchema.describe("Current status"),
  priority: z.enum(["low", "medium", "high"]).optional().describe("Priority level"),
  dependsOn: z.array(z.string()).optional().describe("Blocking todo IDs"),
});

const selectionRangeSchema = z.object({
  from: z.number().describe("Selection start"),
  to: z.number().describe("Selection end"),
});

export const writeTodosParameters = z.object({
  title: z.string().optional().describe("Optional list title"),
  todos: z.array(todoSchema).min(1).describe("Full todo list (replaces previous)"),
  target: z
    .object({
      documentId: z.string().optional().describe("Target document ID"),
      selectionRange: selectionRangeSchema.optional().describe("Target selection"),
    })
    .optional(),
});

export type WriteTodosArgs = z.infer<typeof writeTodosParameters>;
export type TodoItem = z.infer<typeof todoSchema>;
export type TodoStatus = z.infer<typeof todoStatusSchema>;

export const writeTodosTool = tool({
  description:
    "Write or update a structured todo list. Each call replaces the previous list. " +
    "Include all todos with their current status (pending/in_progress/completed).",
  inputSchema: writeTodosParameters,
});

// =============================================================================
// Task Slug Selection
// =============================================================================

const taskSlugOptionSchema = z.object({
  taskSlug: z.string().describe("Task slug identifier"),
  label: z.string().describe("UI label"),
  description: z.string().optional().describe("Optional helper text"),
});

export const requestTaskSlugTool = tool({
  description: "Ask the user to choose an AI task slug for model routing.",
  inputSchema: z.object({
    reason: z.string().optional().describe("Optional reason shown in UI"),
    allowlist: z.array(z.string()).optional().describe("Allowed task slugs"),
    prefer: z.array(z.string()).optional().describe("Preferred task slug order"),
    modality: z.enum(["text", "image"]).optional().describe("Optional modality hint"),
    title: z.string().optional().describe("Optional title for the picker"),
    description: z.string().optional().describe("Optional helper text"),
    recommended: z.array(taskSlugOptionSchema).optional().describe("Suggested task options"),
    allowAuto: z.boolean().optional().describe("Allow automatic selection"),
  }),
});

// =============================================================================
// Spawn Task Schema
// =============================================================================

export const spawnTaskParameters = z.object({
  agent: z.enum(["research", "analysis", "writing"]).describe("Sub-agent type"),
  title: z.string().describe("Task title"),
  instructions: z.string().describe("Task instructions"),
  taskSlug: z.string().optional().describe("AITaskSlug to route the sub-agent model"),
  maxSteps: z.number().optional().describe("Step limit (default 4)"),
  requireCitations: z.boolean().optional().describe("Require citations"),
});

export type SpawnTaskArgs = z.infer<typeof spawnTaskParameters>;

export const spawnTaskTool = tool({
  description:
    "Spawn a specialized sub-agent for research, analysis, or writing tasks. " +
    "Returns the agent's output and any artifacts.",
  inputSchema: spawnTaskParameters,
});
