/**
 * update_entity tool executor
 */

import type { Entity, EntityType } from "@mythos/core";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";

export interface UpdateEntityArgs {
  entityName: string;
  entityType?: EntityType;
  updates: {
    name?: string;
    aliases?: string[];
    notes?: string;
    properties?: Record<string, unknown>;
    archetype?: string;
    backstory?: string;
    goals?: string[];
    fears?: string[];
    climate?: string;
    atmosphere?: string;
    category?: string;
    abilities?: string[];
    leader?: string;
    headquarters?: string;
    factionGoals?: string[];
    rules?: string[];
    limitations?: string[];
  };
}

export interface UpdateEntityResult {
  entityId: string;
  name: string;
  updatedFields: string[];
}

export const updateEntityExecutor: ToolDefinition<UpdateEntityArgs, UpdateEntityResult> = {
  toolName: "update_entity",
  label: "Update Entity",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const fields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );
    return `${args.entityType || "entity"} "${args.entityName}": ${fields.join(", ")}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<UpdateEntityResult>> => {
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

      // Build updates object
      const updates: Partial<Entity> = {};
      const updatedFields: string[] = [];

      if (args.updates.name !== undefined) {
        updates.name = args.updates.name;
        updatedFields.push("name");
      }
      if (args.updates.aliases !== undefined) {
        updates.aliases = args.updates.aliases;
        updatedFields.push("aliases");
      }
      if (args.updates.notes !== undefined) {
        updates.notes = args.updates.notes;
        updatedFields.push("notes");
      }

      // Handle type-specific fields via properties
      const propertyUpdates = {
        ...(entity.properties ?? {}),
        ...(args.updates.properties ?? {}),
      };
      let hasPropertyUpdates =
        args.updates.properties !== undefined &&
        Object.keys(args.updates.properties).length > 0;
      if (hasPropertyUpdates) {
        updatedFields.push("properties");
      }

      const propertyFields = [
        "archetype", "backstory", "goals", "fears",
        "climate", "atmosphere",
        "category", "abilities",
        "leader", "headquarters", "factionGoals",
        "rules", "limitations",
      ];

      for (const field of propertyFields) {
        const value = args.updates[field as keyof typeof args.updates];
        if (value !== undefined) {
          propertyUpdates[field] = value;
          updatedFields.push(field);
          hasPropertyUpdates = true;
        }
      }

      if (hasPropertyUpdates) {
        updates.properties = propertyUpdates;
      }

      // Persist updates
      const result = await ctx.updateEntity(entity.id, updates);

      if (result.data) {
        return {
          success: true,
          result: {
            entityId: entity.id,
            name: result.data.name,
            updatedFields,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Failed to update entity",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
