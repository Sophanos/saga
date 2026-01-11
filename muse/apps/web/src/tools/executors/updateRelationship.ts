/**
 * update_relationship tool executor
 */

import type { PropertyValue, Relationship, RelationType } from "@mythos/core";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveRelationship } from "../types";

export interface UpdateRelationshipArgs {
  sourceName: string;
  targetName: string;
  type: RelationType;
  updates: {
    notes?: string;
    strength?: number;
    bidirectional?: boolean;
    metadata?: Record<string, PropertyValue>;
  };
}

export interface UpdateRelationshipResult {
  relationshipId: string;
  sourceId: string;
  targetId: string;
  updatedFields: string[];
}

export const updateRelationshipExecutor: ToolDefinition<UpdateRelationshipArgs, UpdateRelationshipResult> = {
  toolName: "update_relationship",
  label: "Update Relationship",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const fields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );
    return `${args.sourceName} → ${args.type} → ${args.targetName}: ${fields.join(", ")}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<UpdateRelationshipResult>> => {
    try {
      // Resolve relationship by source, target, and type
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

      // Build updates object
      const updates: Partial<Relationship> = {};
      const updatedFields: string[] = [];

      if (args.updates.notes !== undefined) {
        updates.notes = args.updates.notes;
        updatedFields.push("notes");
      }

      if (args.updates.strength !== undefined) {
        updates.strength = args.updates.strength;
        updatedFields.push("strength");
      }

      if (args.updates.bidirectional !== undefined) {
        updates.bidirectional = args.updates.bidirectional;
        updatedFields.push("bidirectional");
      }

      if (args.updates.metadata !== undefined) {
        updates.metadata = args.updates.metadata;
        updatedFields.push("metadata");
      }

      if (updatedFields.length === 0) {
        return {
          success: false,
          error: "No valid fields to update",
        };
      }

      // Persist updates
      const result = await ctx.updateRelationship(rel.id, updates);

      if (result.data) {
        return {
          success: true,
          result: {
            relationshipId: rel.id,
            sourceId: rel.sourceId,
            targetId: rel.targetId,
            updatedFields,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Failed to update relationship",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
