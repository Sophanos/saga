/**
 * delete_entity tool executor
 */

import type { EntityType } from "@mythos/core";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";

export interface DeleteEntityArgs {
  entityName: string;
  entityType?: EntityType;
  reason?: string;
}

export interface DeleteEntityResult {
  entityId: string;
  name: string;
}

export const deleteEntityExecutor: ToolDefinition<DeleteEntityArgs, DeleteEntityResult> = {
  toolName: "delete_entity",
  label: "Delete Entity",
  requiresConfirmation: true,
  danger: "destructive",

  renderSummary: (args) =>
    `${args.entityType || "entity"}: "${args.entityName}"${args.reason ? ` (${args.reason})` : ""}`,

  execute: async (args, ctx): Promise<ToolExecutionResult<DeleteEntityResult>> => {
    try {
      // Resolve entity by name
      const resolution = resolveEntityByName(args.entityName, ctx.entities, args.entityType);

      if (!resolution.found) {
        if (resolution.candidates) {
          return {
            success: false,
            error: `Ambiguous: found ${resolution.candidates.length} entities named "${args.entityName}". Candidates: ${resolution.candidates.map((e) => `${e.name} (${e.type})`).join(", ")}`,
          };
        }
        return { success: false, error: resolution.error };
      }

      const entity = resolution.entity!;

      // Delete from database
      const result = await ctx.deleteEntity(entity.id);

      if (result.success) {
        // Remove from store
        ctx.removeEntity(entity.id);

        return {
          success: true,
          result: {
            entityId: entity.id,
            name: entity.name,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Failed to delete entity",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
