/**
 * delete_relationship tool executor
 */

import type { RelationType } from "@mythos/core";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveRelationship } from "../types";

export interface DeleteRelationshipArgs {
  sourceName: string;
  targetName: string;
  type: RelationType;
  reason?: string;
}

export interface DeleteRelationshipResult {
  relationshipId: string;
  sourceId: string;
  targetId: string;
}

export const deleteRelationshipExecutor: ToolDefinition<DeleteRelationshipArgs, DeleteRelationshipResult> = {
  toolName: "delete_relationship",
  label: "Delete Relationship",
  requiresConfirmation: true,
  danger: "destructive",

  renderSummary: (args) =>
    `${args.sourceName} → ${args.type} → ${args.targetName}${args.reason ? ` (${args.reason})` : ""}`,

  execute: async (args, ctx): Promise<ToolExecutionResult<DeleteRelationshipResult>> => {
    try {
      // Resolve relationship
      const resolution = resolveRelationship(
        args.sourceName,
        args.targetName,
        args.type,
        ctx.entities,
        ctx.relationships
      );

      if (!resolution.found || !resolution.relationship) {
        return { success: false, error: resolution.error };
      }

      const rel = resolution.relationship;

      // Delete from database
      const result = await ctx.deleteRelationship(rel.id);

      if (result.success) {
        // Remove from store
        ctx.removeRelationship(rel.id);

        return {
          success: true,
          result: {
            relationshipId: rel.id,
            sourceId: rel.sourceId,
            targetId: rel.targetId,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Failed to delete relationship",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
