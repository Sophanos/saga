/**
 * Project Graph Tool Handlers - Server-side execution for entity/relationship tools
 */

import { v } from "convex/values";
import { internalAction, internalQuery, internalMutation, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { canonicalizeName } from "../../lib/canonicalize";
import {
  getEntityTypeDef,
  getRelationshipTypeDef,
  type ProjectTypeRegistryResolved,
  validateEntityProperties,
  validateRelationshipMetadata,
} from "../../lib/typeRegistry";
import type {
  CreateEntityArgs,
  UpdateEntityArgs,
  CreateRelationshipArgs,
  UpdateRelationshipArgs,
  CreateNodeArgs,
  UpdateNodeArgs,
  CreateEdgeArgs,
  UpdateEdgeArgs,
  GraphMutationArgs,
} from "./projectGraphTools";

// =============================================================================
// Internal Queries - Access + Lookups
// =============================================================================

export const getProjectMemberRole = internalQuery({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, { projectId, userId }) => {
    const project = await ctx.db.get(projectId);
    if (!project) {
      return { projectExists: false, role: null };
    }

    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();

    return { projectExists: true, role: member?.role ?? null };
  },
});

export const findEntityByCanonical = internalQuery({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, name, type }) => {
    const canonicalName = canonicalizeName(name);

    if (type) {
      const matches = await ctx.db
        .query("entities")
        .withIndex("by_project_type_canonical", (q) =>
          q
            .eq("projectId", projectId)
            .eq("type", type)
            .eq("canonicalName", canonicalName)
        )
        .collect();

      if (matches.length > 0) {
        return matches;
      }

      const fallback = await ctx.db
        .query("entities")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", projectId).eq("type", type)
        )
        .collect();

      return fallback.filter((entity) => {
        if (canonicalizeName(entity.name) === canonicalName) return true;
        return entity.aliases.some(
          (alias) => canonicalizeName(alias) === canonicalName
        );
      });
    }

    const matches = await ctx.db
      .query("entities")
      .withIndex("by_project_canonical", (q) =>
        q.eq("projectId", projectId).eq("canonicalName", canonicalName)
      )
      .collect();

    if (matches.length > 0) {
      return matches;
    }

    const fallback = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return fallback.filter((entity) => {
      if (canonicalizeName(entity.name) === canonicalName) return true;
      return entity.aliases.some(
        (alias) => canonicalizeName(alias) === canonicalName
      );
    });
  },
});

export const findRelationship = internalQuery({
  args: {
    projectId: v.id("projects"),
    sourceId: v.id("entities"),
    targetId: v.id("entities"),
    type: v.string(),
  },
  handler: async (ctx, { sourceId, targetId, type }) => {
    const rel = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
      .filter((q) =>
        q.and(q.eq(q.field("targetId"), targetId), q.eq(q.field("type"), type))
      )
      .first();

    return rel;
  },
});

// =============================================================================
// Internal Mutations - Entity/Relationship CRUD
// =============================================================================

export const createEntityMutation = internalMutation({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    properties: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const canonicalName = canonicalizeName(args.name);
    return await ctx.db.insert("entities", {
      projectId: args.projectId,
      type: args.type,
      name: args.name,
      canonicalName,
      aliases: normalizeAliases(args.aliases ?? []),
      properties: args.properties ?? {},
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateEntityMutation = internalMutation({
  args: {
    id: v.id("entities"),
    updates: v.any(),
  },
  handler: async (ctx, { id, updates }) => {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, { ...cleanUpdates, updatedAt: Date.now() });
    return id;
  },
});

export const createRelationshipMutation = internalMutation({
  args: {
    projectId: v.id("projects"),
    sourceId: v.id("entities"),
    targetId: v.id("entities"),
    type: v.string(),
    bidirectional: v.optional(v.boolean()),
    strength: v.optional(v.number()),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("relationships", {
      projectId: args.projectId,
      sourceId: args.sourceId,
      targetId: args.targetId,
      type: args.type,
      bidirectional: args.bidirectional ?? false,
      strength: args.strength,
      notes: args.notes,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const updateRelationshipMutation = internalMutation({
  args: {
    id: v.id("relationships"),
    updates: v.any(),
  },
  handler: async (ctx, { id, updates }) => {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

// =============================================================================
// Tool Execution Actions
// =============================================================================

type ToolActorContext = {
  actorType: "ai" | "user" | "system";
  actorUserId?: string;
  actorAgentId?: string;
  actorName?: string;
};

type ToolErrorCode =
  | "ACCESS_DENIED"
  | "INVALID_TYPE"
  | "SCHEMA_VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "NOT_IMPLEMENTED";

type ToolFailure = {
  success: false;
  code: ToolErrorCode;
  message: string;
  details?: unknown;
};

function fail(
  code: ToolErrorCode,
  message: string,
  details?: unknown
): ToolFailure {
  return { success: false, code, message, details };
}

function resolveActor(actor?: ToolActorContext) {
  return {
    actorType: actor?.actorType ?? "system",
    actorUserId: actor?.actorUserId,
    actorAgentId: actor?.actorAgentId,
    actorName: actor?.actorName,
  };
}

function normalizeAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    const key = canonicalizeName(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

async function getProjectAccessError(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  actorUserId?: string
): Promise<ToolFailure | null> {
  if (!actorUserId) {
    return fail("ACCESS_DENIED", "Actor user id is required");
  }

  const access = await ctx.runQuery(
    (internal as any)["ai/tools/projectGraphHandlers"].getProjectMemberRole,
    { projectId, userId: actorUserId }
  );

  if (!access?.projectExists) {
    return fail("ACCESS_DENIED", "Project not found");
  }

  if (!access.role) {
    return fail("ACCESS_DENIED", "Access denied");
  }

  if (access.role === "viewer") {
    return fail("ACCESS_DENIED", "Edit access denied");
  }

  return null;
}

async function resolveEntityByName(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  name: string,
  type?: string
): Promise<{ entity: Doc<"entities"> | null; error?: string }> {
  const matches = (await ctx.runQuery(
    (internal as any)["ai/tools/projectGraphHandlers"].findEntityByCanonical,
    { projectId, name, type }
  )) as Doc<"entities">[] | null;

  if (!matches || matches.length === 0) {
    return { entity: null };
  }

  if (matches.length > 1) {
    const types = Array.from(new Set(matches.map((match) => match.type)));
    return {
      entity: null,
      error: `Multiple entities named "${name}" found (${types.join(", ")})`,
    };
  }

  return { entity: matches[0] };
}

function buildEntityProperties(args: {
  properties?: Record<string, unknown>;
}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args.properties ?? {}).filter(([_, v]) => v !== undefined)
  );
}

async function getResolvedRegistry(
  ctx: ActionCtx,
  projectId: Id<"projects">
): Promise<ProjectTypeRegistryResolved> {
  return (await ctx.runQuery((internal as any).projectTypeRegistry.getResolvedInternal, {
    projectId,
  })) as ProjectTypeRegistryResolved;
}

type NormalizedGraphMutation = {
  legacyToolName:
    | "create_entity"
    | "update_entity"
    | "create_relationship"
    | "update_relationship"
    | "create_node"
    | "update_node"
    | "create_edge"
    | "update_edge";
  toolArgs: Record<string, unknown>;
  kind: "entity" | "relationship";
};

function isToolFailure(result: ToolFailure | NormalizedGraphMutation): result is ToolFailure {
  return "success" in result && result.success === false;
}

function isRelationshipMutation(
  args: GraphMutationArgs
): args is Extract<GraphMutationArgs, { target: "relationship" | "edge" }> {
  return args.target === "relationship" || args.target === "edge";
}

function normalizeGraphMutationArgs(args: GraphMutationArgs): NormalizedGraphMutation | ToolFailure {
  if (args.action === "delete") {
    return fail("NOT_IMPLEMENTED", "Graph deletion is not available yet.");
  }

  if (args.target === "entity" || args.target === "node") {
    if (args.action === "create") {
      return {
        legacyToolName: args.target === "node" ? "create_node" : "create_entity",
        toolArgs: {
          type: args.type,
          name: args.name,
          aliases: args.aliases,
          notes: args.notes,
          properties: args.properties,
          citations: args.citations,
        },
        kind: "entity",
      };
    }

    return {
      legacyToolName: args.target === "node" ? "update_node" : "update_entity",
      toolArgs:
        args.target === "node"
          ? {
              nodeName: args.entityName,
              nodeType: args.entityType,
              updates: args.updates,
              citations: args.citations,
            }
          : {
              entityName: args.entityName,
              entityType: args.entityType,
              updates: args.updates,
              citations: args.citations,
            },
      kind: "entity",
    };
  }

  if (!isRelationshipMutation(args)) {
    return fail("INVALID_TYPE", "Unsupported graph mutation target.");
  }

  if (args.action === "create") {
    return {
      legacyToolName: args.target === "edge" ? "create_edge" : "create_relationship",
      toolArgs: {
        type: args.type,
        sourceName: args.sourceName,
        targetName: args.targetName,
        bidirectional: args.bidirectional,
        strength: args.strength,
        notes: args.notes,
        metadata: args.metadata,
        citations: args.citations,
      },
      kind: "relationship",
    };
  }

  return {
    legacyToolName: args.target === "edge" ? "update_edge" : "update_relationship",
    toolArgs: {
      type: args.type,
      sourceName: args.sourceName,
      targetName: args.targetName,
      updates: args.updates,
      citations: args.citations,
    },
    kind: "relationship",
  };
}

export const executeGraphMutation = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; targetId: string; message: string; kind: "entity" | "relationship" } | ToolFailure> => {
    const args = toolArgs as GraphMutationArgs;
    const normalized = normalizeGraphMutationArgs(args);

    if (isToolFailure(normalized)) {
      return normalized;
    }

    const { legacyToolName, toolArgs: legacyArgs, kind } = normalized;
    const actionParams = {
      projectId,
      toolArgs: legacyArgs,
      actor,
      source: sourceContext,
    };

    let result: unknown;
    switch (legacyToolName) {
      case "create_entity":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateEntity, actionParams);
        break;
      case "update_entity":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateEntity, actionParams);
        break;
      case "create_relationship":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateRelationship, actionParams);
        break;
      case "update_relationship":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateRelationship, actionParams);
        break;
      case "create_node":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateNode, actionParams);
        break;
      case "update_node":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateNode, actionParams);
        break;
      case "create_edge":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeCreateEdge, actionParams);
        break;
      case "update_edge":
        result = await ctx.runAction((internal as any)["ai/tools/projectGraphHandlers"].executeUpdateEdge, actionParams);
        break;
      default:
        return fail("CONFLICT", `Unsupported mutation: ${legacyToolName}`);
    }

    const resolved = result as
      | { success: true; entityId?: string; relationshipId?: string; message: string }
      | ToolFailure;

    if ("success" in resolved && resolved.success) {
      const targetId = (resolved.entityId ?? resolved.relationshipId) as string | undefined;
      if (!targetId) {
        return fail("CONFLICT", "Mutation completed without a target id.");
      }
      return {
        success: true,
        targetId,
        message: resolved.message,
        kind,
      };
    }

    return resolved;
  },
});

export const executeCreateEntity = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; entityId: string; message: string } | ToolFailure> => {
    const args = toolArgs as CreateEntityArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    const def = getEntityTypeDef(registry, args.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown entity type: ${args.type}`);
    }

    const resolved = await resolveEntityByName(
      ctx,
      projectIdVal,
      args.name,
      args.type
    );
    if (resolved.error) {
      return fail("CONFLICT", resolved.error);
    }
    if (resolved.entity) {
      return fail(
        "CONFLICT",
        `Entity "${args.name}" already exists as ${resolved.entity.type}`
      );
    }

    const properties = buildEntityProperties(args);
    const propertiesResult = validateEntityProperties(def, properties);
    if (!propertiesResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        propertiesResult.error.message,
        propertiesResult.error.errors
      );
    }

    const entityId = await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].createEntityMutation,
      {
        projectId: projectIdVal,
        type: args.type,
        name: args.name,
        aliases: args.aliases,
        properties: propertiesResult.value,
        notes: args.notes,
      }
    );

    await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
      projectId: projectIdVal,
      targetType: "entity",
      targetId: entityId,
    });

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "entity_created",
      summary: `Created ${args.type} "${args.name}"`,
      metadata: {
        entityId,
        type: args.type,
        name: args.name,
        source: sourceContext,
      },
    });

    return {
      success: true,
      entityId: entityId as string,
      message: `Created ${args.type} "${args.name}"`,
    };
  },
});

export const executeUpdateEntity = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; entityId: string; message: string } | ToolFailure> => {
    const args = toolArgs as UpdateEntityArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);

    const resolved = await resolveEntityByName(
      ctx,
      projectIdVal,
      args.entityName,
      args.entityType
    );
    if (resolved.error) {
      return fail("CONFLICT", resolved.error);
    }
    if (!resolved.entity) {
      return fail("NOT_FOUND", `Entity "${args.entityName}" not found`);
    }

    const entity = resolved.entity;
    const def = getEntityTypeDef(registry, entity.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown entity type: ${entity.type}`);
    }
    const { name, aliases, notes, properties } = args.updates;

    const dbUpdates: Record<string, unknown> = {};
    if (name !== undefined) {
      dbUpdates["name"] = name;
      dbUpdates["canonicalName"] = canonicalizeName(name);
    }
    if (aliases !== undefined) dbUpdates["aliases"] = normalizeAliases(aliases);
    if (notes !== undefined) dbUpdates["notes"] = notes;

    const existingProps = (entity.properties ?? {}) as Record<string, unknown>;
    const propertyUpdates = buildEntityProperties({
      properties: properties as Record<string, unknown> | undefined,
    });
    const nextProperties =
      Object.keys(propertyUpdates).length > 0
        ? { ...existingProps, ...propertyUpdates }
        : existingProps;
    const propertiesResult = validateEntityProperties(def, nextProperties);
    if (!propertiesResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        propertiesResult.error.message,
        propertiesResult.error.errors
      );
    }
    if (Object.keys(propertyUpdates).length > 0) {
      dbUpdates["properties"] = propertiesResult.value;
    }

    await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].updateEntityMutation,
      { id: entity._id, updates: dbUpdates }
    );

    await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
      projectId: entity.projectId,
      targetType: "entity",
      targetId: entity._id,
    });

    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "entity_updated",
      summary: `Updated ${entity.type} "${entity.name}"`,
      metadata: {
        entityId: entity._id,
        updatedFields,
        source: sourceContext,
      },
    });

    return {
      success: true,
      entityId: entity._id as string,
      message: `Updated ${entity.type} "${entity.name}": ${updatedFields.join(", ")}`,
    };
  },
});

export const executeCreateRelationship = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; relationshipId: string; message: string } | ToolFailure> => {
    const args = toolArgs as CreateRelationshipArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    const def = getRelationshipTypeDef(registry, args.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown relationship type: ${args.type}`);
    }
    const metadataResult = validateRelationshipMetadata(def, args.metadata);
    if (!metadataResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        metadataResult.error.message,
        metadataResult.error.errors
      );
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) {
      return fail("CONFLICT", sourceResult.error);
    }
    if (!sourceResult.entity) {
      return fail("NOT_FOUND", `Source entity "${args.sourceName}" not found`);
    }

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) {
      return fail("CONFLICT", targetResult.error);
    }
    if (!targetResult.entity) {
      return fail("NOT_FOUND", `Target entity "${args.targetName}" not found`);
    }

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const existing = await ctx.runQuery(
      (internal as any)["ai/tools/projectGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (existing) {
      return fail(
        "CONFLICT",
        `Relationship ${args.sourceName} → ${args.type} → ${args.targetName} already exists`
      );
    }

    const relId = await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].createRelationshipMutation,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
        bidirectional: args.bidirectional,
        strength: args.strength,
        notes: args.notes,
        metadata: args.metadata === undefined ? undefined : metadataResult.value,
      }
    );

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "relationship_created",
      summary: `Created relationship ${args.sourceName} → ${args.type} → ${args.targetName}`,
      metadata: {
        relationshipId: relId,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
        source: sourceContext,
      },
    });

    const direction = args.bidirectional ? "↔" : "→";
    return {
      success: true,
      relationshipId: relId as string,
      message: `Created relationship: ${args.sourceName} ${direction} ${args.type} ${direction} ${args.targetName}`,
    };
  },
});

export const executeUpdateRelationship = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; relationshipId: string; message: string } | ToolFailure> => {
    const args = toolArgs as UpdateRelationshipArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    const def = getRelationshipTypeDef(registry, args.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown relationship type: ${args.type}`);
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) {
      return fail("CONFLICT", sourceResult.error);
    }
    if (!sourceResult.entity) {
      return fail("NOT_FOUND", `Source entity "${args.sourceName}" not found`);
    }

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) {
      return fail("CONFLICT", targetResult.error);
    }
    if (!targetResult.entity) {
      return fail("NOT_FOUND", `Target entity "${args.targetName}" not found`);
    }

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const rel = await ctx.runQuery(
      (internal as any)["ai/tools/projectGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (!rel) {
      return fail(
        "NOT_FOUND",
        `Relationship ${args.sourceName} → ${args.type} → ${args.targetName} not found`
      );
    }

    const nextMetadata = args.updates.metadata ?? rel.metadata;
    const metadataResult = validateRelationshipMetadata(def, nextMetadata);
    if (!metadataResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        metadataResult.error.message,
        metadataResult.error.errors
      );
    }
    if (args.updates.metadata !== undefined) {
      args.updates.metadata = metadataResult.value as typeof args.updates.metadata;
    }

    await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].updateRelationshipMutation,
      { id: rel._id, updates: args.updates }
    );

    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "relationship_updated",
      summary: `Updated relationship ${args.sourceName} → ${args.type} → ${args.targetName}`,
      metadata: {
        relationshipId: rel._id,
        updatedFields,
        source: sourceContext,
      },
    });

    return {
      success: true,
      relationshipId: rel._id as string,
      message: `Updated relationship ${args.sourceName} → ${args.type} → ${args.targetName}: ${updatedFields.join(", ")}`,
    };
  },
});

export const executeCreateNode = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; entityId: string; message: string } | ToolFailure> => {
    const args = toolArgs as CreateNodeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    const def = getEntityTypeDef(registry, args.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown node type: ${args.type}`);
    }

    const resolved = await resolveEntityByName(ctx, projectIdVal, args.name, args.type);
    if (resolved.error) {
      return fail("CONFLICT", resolved.error);
    }
    if (resolved.entity) {
      return fail(
        "CONFLICT",
        `Node "${args.name}" already exists as ${resolved.entity.type}`
      );
    }

    const propertiesResult = validateEntityProperties(def, args.properties ?? {});
    if (!propertiesResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        propertiesResult.error.message,
        propertiesResult.error.errors
      );
    }

    const entityId = await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].createEntityMutation,
      {
        projectId: projectIdVal,
        type: args.type,
        name: args.name,
        aliases: args.aliases,
        properties: propertiesResult.value,
        notes: args.notes,
      }
    );

    await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
      projectId: projectIdVal,
      targetType: "entity",
      targetId: entityId,
    });

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "entity_created",
      summary: `Created ${args.type} "${args.name}"`,
      metadata: {
        entityId,
        type: args.type,
        name: args.name,
        source: sourceContext,
      },
    });

    return {
      success: true,
      entityId: entityId as string,
      message: `Created ${args.type} "${args.name}"`,
    };
  },
});

export const executeUpdateNode = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; entityId: string; message: string } | ToolFailure> => {
    const args = toolArgs as UpdateNodeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);

    const resolved = await resolveEntityByName(ctx, projectIdVal, args.nodeName, args.nodeType);
    if (resolved.error) {
      return fail("CONFLICT", resolved.error);
    }
    if (!resolved.entity) {
      return fail("NOT_FOUND", `Node "${args.nodeName}" not found`);
    }

    const entity = resolved.entity;
    const def = getEntityTypeDef(registry, entity.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown node type: ${entity.type}`);
    }

    const { name, aliases, notes, properties } = args.updates;

    const dbUpdates: Record<string, unknown> = {};
    if (name !== undefined) {
      dbUpdates["name"] = name;
      dbUpdates["canonicalName"] = canonicalizeName(name);
    }
    if (aliases !== undefined) dbUpdates["aliases"] = normalizeAliases(aliases);
    if (notes !== undefined) dbUpdates["notes"] = notes;

    const existingProps = (entity.properties ?? {}) as Record<string, unknown>;
    const nextProperties =
      properties !== undefined
        ? {
            ...existingProps,
            ...(properties as Record<string, unknown>),
          }
        : existingProps;
    const propertiesResult = validateEntityProperties(def, nextProperties);
    if (!propertiesResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        propertiesResult.error.message,
        propertiesResult.error.errors
      );
    }
    if (properties !== undefined) {
      dbUpdates["properties"] = propertiesResult.value;
    }

    await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].updateEntityMutation,
      { id: entity._id, updates: dbUpdates }
    );

    await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
      projectId: entity.projectId,
      targetType: "entity",
      targetId: entity._id,
    });

    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "entity_updated",
      summary: `Updated ${entity.type} "${entity.name}"`,
      metadata: {
        entityId: entity._id,
        updatedFields,
        source: sourceContext,
      },
    });

    return {
      success: true,
      entityId: entity._id as string,
      message: `Updated ${entity.type} "${entity.name}": ${updatedFields.join(", ")}`,
    };
  },
});

export const executeCreateEdge = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; relationshipId: string; message: string } | ToolFailure> => {
    const args = toolArgs as CreateEdgeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    const def = getRelationshipTypeDef(registry, args.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown edge type: ${args.type}`);
    }
    const metadataResult = validateRelationshipMetadata(def, args.metadata);
    if (!metadataResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        metadataResult.error.message,
        metadataResult.error.errors
      );
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) return fail("CONFLICT", sourceResult.error);
    if (!sourceResult.entity) return fail("NOT_FOUND", `Source node "${args.sourceName}" not found`);

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) return fail("CONFLICT", targetResult.error);
    if (!targetResult.entity) return fail("NOT_FOUND", `Target node "${args.targetName}" not found`);

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const existing = await ctx.runQuery(
      (internal as any)["ai/tools/projectGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (existing) {
      return fail(
        "CONFLICT",
        `Edge ${args.sourceName} → ${args.type} → ${args.targetName} already exists`
      );
    }

    const relId = await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].createRelationshipMutation,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
        bidirectional: args.bidirectional,
        strength: args.strength,
        notes: args.notes,
        metadata: args.metadata === undefined ? undefined : metadataResult.value,
      }
    );

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "relationship_created",
      summary: `Created edge ${args.sourceName} → ${args.type} → ${args.targetName}`,
      metadata: {
        relationshipId: relId,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
        source: sourceContext,
      },
    });

    const direction = args.bidirectional ? "↔" : "→";
    return {
      success: true,
      relationshipId: relId as string,
      message: `Created edge: ${args.sourceName} ${direction} ${args.type} ${direction} ${args.targetName}`,
    };
  },
});

export const executeUpdateEdge = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
    actor: v.optional(
      v.object({
        actorType: v.string(),
        actorUserId: v.optional(v.string()),
        actorAgentId: v.optional(v.string()),
        actorName: v.optional(v.string()),
      })
    ),
    source: v.optional(
      v.object({
        streamId: v.optional(v.string()),
        threadId: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        promptMessageId: v.optional(v.string()),
      })
    ),
  },
  handler: async (
    ctx,
    { projectId, toolArgs, actor, source: sourceContext }
  ): Promise<{ success: true; relationshipId: string; message: string } | ToolFailure> => {
    const args = toolArgs as UpdateEdgeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return accessError;
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    const def = getRelationshipTypeDef(registry, args.type);
    if (!def) {
      return fail("INVALID_TYPE", `Unknown edge type: ${args.type}`);
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) return fail("CONFLICT", sourceResult.error);
    if (!sourceResult.entity) return fail("NOT_FOUND", `Source node "${args.sourceName}" not found`);

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) return fail("CONFLICT", targetResult.error);
    if (!targetResult.entity) return fail("NOT_FOUND", `Target node "${args.targetName}" not found`);

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const rel = await ctx.runQuery(
      (internal as any)["ai/tools/projectGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (!rel) {
      return fail(
        "NOT_FOUND",
        `Edge ${args.sourceName} → ${args.type} → ${args.targetName} not found`
      );
    }

    const nextMetadata = args.updates.metadata ?? rel.metadata;
    const metadataResult = validateRelationshipMetadata(def, nextMetadata);
    if (!metadataResult.ok) {
      return fail(
        "SCHEMA_VALIDATION_FAILED",
        metadataResult.error.message,
        metadataResult.error.errors
      );
    }
    if (args.updates.metadata !== undefined) {
      args.updates.metadata = metadataResult.value as typeof args.updates.metadata;
    }

    await ctx.runMutation(
      (internal as any)["ai/tools/projectGraphHandlers"].updateRelationshipMutation,
      { id: rel._id, updates: args.updates }
    );

    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: projectIdVal,
      ...actorInfo,
      action: "relationship_updated",
      summary: `Updated edge ${args.sourceName} → ${args.type} → ${args.targetName}`,
      metadata: {
        relationshipId: rel._id,
        updatedFields,
        source: sourceContext,
      },
    });

    return {
      success: true,
      relationshipId: rel._id as string,
      message: `Updated edge ${args.sourceName} → ${args.type} → ${args.targetName}: ${updatedFields.join(", ")}`,
    };
  },
});
