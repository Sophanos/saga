/**
 * create_relationship tool executor
 */

import type { Relationship, RelationType, PropertyValue } from "@mythos/core";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";

export interface CreateRelationshipArgs {
  sourceName: string;
  targetName: string;
  type: RelationType;
  bidirectional?: boolean;
  notes?: string;
  strength?: number;
  metadata?: Record<string, PropertyValue>;
}

export interface CreateRelationshipResult {
  relationshipId: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
}

export const createRelationshipExecutor: ToolDefinition<CreateRelationshipArgs, CreateRelationshipResult> = {
  toolName: "create_relationship",
  label: "Create Relationship",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) =>
    `${args.sourceName} → ${args.type} → ${args.targetName}${args.bidirectional ? " (bidirectional)" : ""}`,

  execute: async (args, ctx): Promise<ToolExecutionResult<CreateRelationshipResult>> => {
    try {
      // Resolve source entity
      const sourceRes = resolveEntityByName(args.sourceName, ctx.entities);
      if (!sourceRes.found || !sourceRes.entity) {
        return {
          success: false,
          error: sourceRes.candidates
            ? `Ambiguous source: ${sourceRes.candidates.map((e) => `${e.name} (${e.type})`).join(", ")}`
            : `Source entity "${args.sourceName}" not found`,
        };
      }

      // Resolve target entity
      const targetRes = resolveEntityByName(args.targetName, ctx.entities);
      if (!targetRes.found || !targetRes.entity) {
        return {
          success: false,
          error: targetRes.candidates
            ? `Ambiguous target: ${targetRes.candidates.map((e) => `${e.name} (${e.type})`).join(", ")}`
            : `Target entity "${args.targetName}" not found`,
        };
      }

      const sourceId = sourceRes.entity.id;
      const targetId = targetRes.entity.id;

      // Create relationship object
      const relationship: Relationship = {
        id: crypto.randomUUID(),
        sourceId,
        targetId,
        type: args.type,
        bidirectional: args.bidirectional ?? false,
        notes: args.notes,
        strength: args.strength,
        metadata: args.metadata,
        createdAt: new Date(),
      };

      // Persist to database
      const result = await ctx.createRelationship(relationship, ctx.projectId);

      if (result.data) {
        // Add to store
        ctx.addRelationship(result.data);

        return {
          success: true,
          result: {
            relationshipId: result.data.id,
            sourceId,
            targetId,
            type: args.type,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Failed to create relationship",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
