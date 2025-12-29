/**
 * delete_entity tool executor
 */

import type { EntityType } from "@mythos/core";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { withErrorHandling, resolveEntityOrError } from "../utils";

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

  execute: (args, ctx): Promise<ToolExecutionResult<DeleteEntityResult>> =>
    withErrorHandling(async () => {
      // Resolve entity by name
      const resolved = resolveEntityOrError<DeleteEntityResult>(
        args.entityName,
        ctx.entities,
        args.entityType
      );

      if (resolved.ok === false) {
        return resolved.errorResult;
      }

      const entity = resolved.entity;

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
    }),
};
