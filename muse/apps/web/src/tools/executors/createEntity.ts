/**
 * create_entity tool executor
 */

import type { EntityType, PropertyValue } from "@mythos/core";
import { buildEntity, type EntityBuildData } from "@mythos/core";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export interface CreateEntityArgs {
  type: EntityType;
  name: string;
  aliases?: string[];
  notes?: string;
  properties?: Record<string, PropertyValue>;
  // Character-specific
  archetype?: string;
  backstory?: string;
  goals?: string[];
  fears?: string[];
  // Location-specific
  climate?: string;
  atmosphere?: string;
  // Item-specific
  category?: "weapon" | "armor" | "artifact" | "consumable" | "key" | "other";
  abilities?: string[];
  // Faction-specific
  leader?: string;
  headquarters?: string;
  factionGoals?: string[];
  // Magic System-specific
  rules?: string[];
  limitations?: string[];
}

export interface CreateEntityResult {
  entityId: string;
  name: string;
  type: EntityType;
}

export const createEntityExecutor: ToolDefinition<CreateEntityArgs, CreateEntityResult> = {
  toolName: "create_entity",
  label: "Create Entity",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => `${args.type}: "${args.name}"`,

  execute: async (args, ctx): Promise<ToolExecutionResult<CreateEntityResult>> => {
    try {
      // Build entity data from tool args
      const entityData: EntityBuildData = {
        name: args.name,
        type: args.type,
        aliases: args.aliases,
        notes: args.notes,
        properties: args.properties,
        // Character fields
        archetype: args.archetype as EntityBuildData["archetype"],
        backstory: args.backstory,
        goals: args.goals,
        fears: args.fears,
        // Location fields
        climate: args.climate,
        atmosphere: args.atmosphere,
        // Item fields
        category: args.category as EntityBuildData["category"],
        abilities: args.abilities,
        // Faction fields
        leader: args.leader,
        headquarters: args.headquarters,
        factionGoals: args.factionGoals,
        // Magic system fields
        rules: args.rules,
        limitations: args.limitations,
      };

      // Build entity using the factory
      const entity = buildEntity(entityData);

      // Persist to database
      const result = await ctx.createEntity(entity, ctx.projectId);

      if (result.data) {
        // Add to store
        ctx.addEntity(result.data);

        return {
          success: true,
          result: {
            entityId: result.data.id,
            name: result.data.name,
            type: result.data.type as EntityType,
          },
        };
      }

      return {
        success: false,
        error: result.error ?? "Failed to create entity",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
