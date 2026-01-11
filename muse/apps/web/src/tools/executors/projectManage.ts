/**
 * project_manage tool executor
 *
 * Bootstraps (and optionally persists) a project scaffold.
 */

import type { ProjectManageArgs, ProjectManageResult } from "@mythos/agent-protocol";
import { executeProjectManage } from "../../services/ai/agentRuntimeClient";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export interface ProjectManageExecutionResult {
  action: ProjectManageArgs["action"];
  persisted?: boolean;
  templateName?: string;
  templateEntityKindCount?: number;
  templateRelationshipKindCount?: number;
  hasSuggestedStarterEntities?: boolean;
  worldSummary?: string;
  entityCount?: number;
  relationshipCount?: number;
  entitiesCreated?: number;
  relationshipsCreated?: number;
}

export const projectManageExecutor: ToolDefinition<ProjectManageArgs, ProjectManageExecutionResult> = {
  toolName: "project_manage",
  label: "Project Setup",
  requiresConfirmation: true,
  danger: "costly",

  renderSummary: (args) => {
    if (args.action === "bootstrap") {
      const preview =
        args.description.length > 50 ? args.description.slice(0, 50) + "..." : args.description;
      const seed = args.seed ?? true;
      const mode = seed ? "structure + seed" : "structure only";
      return `Bootstrap: "${preview}" (${mode})`;
    }
    if (args.action === "restructure") {
      return `Restructure (${args.changes.length} changes)`;
    }
    return `Pivot → ${args.toTemplate}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<ProjectManageExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for project setup" };
    }

    try {
      ctx.onProgress?.({ stage: "Working...", pct: 10 });

      const result = (await executeProjectManage(args, {
        apiKey: ctx.apiKey,
        signal: ctx.signal,
        projectId: ctx.projectId,
      })) as ProjectManageResult;

      if (result.status === "not_implemented") {
        return { success: false, error: result.message };
      }

      if (result.template) {
        ctx.setTemplateDraft?.({
          template: result.template,
          suggestedStarterEntities: result.suggestedStarterEntities,
        });
      }

      ctx.onProgress?.({ stage: "Complete!", pct: 100 });

      return {
        success: true,
        result: {
          action: result.action,
          persisted: result.persisted,
          templateName: result.template?.name,
          templateEntityKindCount: result.template?.entityKinds.length,
          templateRelationshipKindCount: result.template?.relationshipKinds.length,
          hasSuggestedStarterEntities: (result.suggestedStarterEntities?.length ?? 0) > 0,
          worldSummary: result.worldSummary,
          entityCount: result.entities.length,
          relationshipCount: result.relationships.length,
          entitiesCreated: result.persistence?.entitiesCreated,
          relationshipsCreated: result.persistence?.relationshipsCreated,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to manage project",
      };
    }
  },
};
