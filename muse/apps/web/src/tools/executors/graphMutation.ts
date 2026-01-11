/**
 * graph_mutation tool executor
 */

import type { GraphMutationArgs } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { createEntityExecutor, type CreateEntityArgs } from "./createEntity";
import { updateEntityExecutor, type UpdateEntityArgs } from "./updateEntity";
import { createRelationshipExecutor, type CreateRelationshipArgs } from "./createRelationship";
import { updateRelationshipExecutor, type UpdateRelationshipArgs } from "./updateRelationship";

export interface GraphMutationExecutionResult {
  targetId?: string;
  kind: "entity" | "relationship";
  message: string;
}

type GraphMutationRoute =
  | {
      kind: "entity";
      action: "create" | "update";
      executor: typeof createEntityExecutor | typeof updateEntityExecutor;
      args: CreateEntityArgs | UpdateEntityArgs;
    }
  | {
      kind: "relationship";
      action: "create" | "update";
      executor: typeof createRelationshipExecutor | typeof updateRelationshipExecutor;
      args: CreateRelationshipArgs | UpdateRelationshipArgs;
    };

function resolveGraphMutationRoute(args: GraphMutationArgs): GraphMutationRoute | null {
  if (args.action === "delete") return null;

  if (args.target === "entity" || args.target === "node") {
    if (args.action === "create") {
      return {
        kind: "entity",
        action: "create",
        executor: createEntityExecutor,
        args: {
          type: args.type as CreateEntityArgs["type"],
          name: args.name,
          aliases: args.aliases,
          notes: args.notes,
          properties: args.properties,
          archetype: args.archetype,
          backstory: args.backstory,
          goals: args.goals,
          fears: args.fears,
        },
      };
    }

    return {
      kind: "entity",
      action: "update",
      executor: updateEntityExecutor,
      args: {
        entityName: args.entityName,
        entityType: args.entityType as UpdateEntityArgs["entityType"],
        updates: args.updates,
      },
    };
  }

  if (args.action === "create") {
    return {
      kind: "relationship",
      action: "create",
      executor: createRelationshipExecutor,
      args: {
        type: args.type as CreateRelationshipArgs["type"],
        sourceName: args.sourceName,
        targetName: args.targetName,
        bidirectional: args.bidirectional,
        strength: args.strength,
        notes: args.notes,
        metadata: args.metadata,
      },
    };
  }

  return {
    kind: "relationship",
    action: "update",
    executor: updateRelationshipExecutor,
    args: {
      type: args.type as UpdateRelationshipArgs["type"],
      sourceName: args.sourceName,
      targetName: args.targetName,
      updates: args.updates,
    },
  };
}

export const graphMutationExecutor: ToolDefinition<
  GraphMutationArgs,
  GraphMutationExecutionResult
> = {
  toolName: "graph_mutation",
  label: "Graph Mutation",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const action = args.action;
    const target = args.target;
    if (target === "relationship" || target === "edge") {
      return `${action} ${target}: ${args.sourceName} → ${args.type} → ${args.targetName}`;
    }
    const name = "name" in args ? args.name : args.entityName;
    return `${action} ${target}: ${name}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<GraphMutationExecutionResult>> => {
    const route = resolveGraphMutationRoute(args);
    if (!route) {
      return { success: false, error: "Delete mutations are not supported yet" };
    }

    const result = await route.executor.execute(route.args as never, ctx);

    if (!result.success) {
      return { success: false, error: result.error ?? "Graph mutation failed" };
    }

    const targetId =
      (result.result as { entityId?: string; relationshipId?: string } | undefined)?.entityId ??
      (result.result as { entityId?: string; relationshipId?: string } | undefined)?.relationshipId;

    return {
      success: true,
      result: {
        targetId,
        kind: route.kind,
        message: `${route.action} ${route.kind} complete`,
      },
    };
  },
};
