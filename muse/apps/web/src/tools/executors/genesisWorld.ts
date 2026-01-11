/**
 * genesis_world tool executor
 *
 * Generates a complete world scaffold and applies it to the project.
 */

import { buildEntity, buildRelationship } from "@mythos/core";
import type { EntityType, RelationType } from "@mythos/core";
import type { GenesisWorldArgs } from "@mythos/agent-protocol";
import { executeGenesisWorld } from "../../services/ai/agentRuntimeClient";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export interface GenesisWorldExecutionResult {
  worldSummary: string;
  entitiesCreated: number;
  relationshipsCreated: number;
  outlineItemsCreated: number;
}

export const genesisWorldExecutor: ToolDefinition<GenesisWorldArgs, GenesisWorldExecutionResult> = {
  toolName: "genesis_world",
  label: "Generate World",
  requiresConfirmation: true,
  danger: "costly",

  renderSummary: (args) => {
    const preview = args.prompt.length > 50 ? args.prompt.slice(0, 50) + "..." : args.prompt;
    return `World: "${preview}"`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<GenesisWorldExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for world generation" };
    }

    try {
      ctx.onProgress?.({ stage: "Generating world scaffold...", pct: 10 });

      // Call the Saga API
      const result = await executeGenesisWorld(args, {
        apiKey: ctx.apiKey,
        signal: ctx.signal,
        projectId: ctx.projectId,
      });

      ctx.onProgress?.({ stage: "Creating entities...", pct: 50 });

      // Map tempId -> realId for relationship creation
      const idMap = new Map<string, string>();
      let entitiesCreated = 0;
      let relationshipsCreated = 0;

      // Create entities
      for (const genEntity of result.entities) {
        const entity = buildEntity({
          name: genEntity.name,
          type: genEntity.type as EntityType,
          notes: genEntity.description,
          ...genEntity.properties,
        });

        const dbResult = await ctx.createEntity(entity, ctx.projectId);
        if (dbResult.data) {
          ctx.addEntity(dbResult.data);
          idMap.set(genEntity.tempId, dbResult.data.id);
          entitiesCreated++;
        }

        ctx.onProgress?.({
          stage: `Creating entities... (${entitiesCreated}/${result.entities.length})`,
          pct: 50 + (entitiesCreated / result.entities.length) * 25,
        });
      }

      ctx.onProgress?.({ stage: "Creating relationships...", pct: 75 });

      // Create relationships
      for (const genRel of result.relationships) {
        const sourceId = idMap.get(genRel.sourceTempId);
        const targetId = idMap.get(genRel.targetTempId);

        if (sourceId && targetId) {
          const relationship = buildRelationship({
            sourceId,
            targetId,
            type: genRel.type as RelationType,
            notes: genRel.notes,
          });

          const dbResult = await ctx.createRelationship(relationship, ctx.projectId);
          if (dbResult.data) {
            ctx.addRelationship(dbResult.data);
            relationshipsCreated++;
          }
        }
      }

      ctx.onProgress?.({ stage: "Complete!", pct: 100 });

      return {
        success: true,
        result: {
          worldSummary: result.worldSummary,
          entitiesCreated,
          relationshipsCreated,
          outlineItemsCreated: result.outline?.length ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate world",
      };
    }
  },
};
