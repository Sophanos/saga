/**
 * World Graph Tool Handlers - Server-side execution for entity/relationship tools
 */

import { v } from "convex/values";
import { internalAction, internalQuery, internalMutation, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { canonicalizeName } from "../../lib/canonicalize";
import {
  requireEntityType,
  requireRelationshipType,
  type ProjectTypeRegistryResolved,
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
} from "./worldGraphTools";

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
): Promise<string | null> {
  if (!actorUserId) {
    return "Actor user id is required";
  }

  const access = await ctx.runQuery(
    // @ts-expect-error Deep types
    internal["ai/tools/worldGraphHandlers"].getProjectMemberRole,
    { projectId, userId: actorUserId }
  );

  if (!access?.projectExists) {
    return "Project not found";
  }

  if (!access.role) {
    return "Access denied";
  }

  if (access.role === "viewer") {
    return "Edit access denied";
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
    // @ts-expect-error Deep types
    internal["ai/tools/worldGraphHandlers"].findEntityByCanonical,
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

function buildEntityProperties(args: CreateEntityArgs): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (args.archetype) props["archetype"] = args.archetype;
  if (args.backstory) props["backstory"] = args.backstory;
  if (args.goals) props["goals"] = args.goals;
  if (args.fears) props["fears"] = args.fears;
  if (args.climate) props["climate"] = args.climate;
  if (args.atmosphere) props["atmosphere"] = args.atmosphere;
  if (args.category) props["category"] = args.category;
  if (args.abilities) props["abilities"] = args.abilities;
  if (args.leader) props["leader"] = args.leader;
  if (args.headquarters) props["headquarters"] = args.headquarters;
  if (args.factionGoals) props["factionGoals"] = args.factionGoals;
  if (args.rules) props["rules"] = args.rules;
  if (args.limitations) props["limitations"] = args.limitations;
  return props;
}

async function getResolvedRegistry(
  ctx: ActionCtx,
  projectId: Id<"projects">
): Promise<ProjectTypeRegistryResolved> {
  return (await ctx.runQuery((internal as any).projectTypeRegistry.getResolvedInternal, {
    projectId,
  })) as ProjectTypeRegistryResolved;
}

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
  handler: async (ctx, { projectId, toolArgs, actor, source: sourceContext }): Promise<{ success: boolean; entityId?: string; message: string }> => {
    const args = toolArgs as CreateEntityArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    try {
      requireEntityType(registry, args.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid entity type" };
    }

    const resolved = await resolveEntityByName(
      ctx,
      projectIdVal,
      args.name,
      args.type
    );
    if (resolved.error) {
      return { success: false, message: resolved.error };
    }
    if (resolved.entity) {
      return {
        success: false,
        message: `Entity "${args.name}" already exists as ${resolved.entity.type}`,
      };
    }

    const properties = buildEntityProperties(args);

    const entityId = await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].createEntityMutation,
      {
        projectId: projectIdVal,
        type: args.type,
        name: args.name,
        aliases: args.aliases,
        properties,
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
  handler: async (ctx, { projectId, toolArgs, actor, source: sourceContext }): Promise<{ success: boolean; entityId?: string; message: string }> => {
    const args = toolArgs as UpdateEntityArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);

    const resolved = await resolveEntityByName(
      ctx,
      projectIdVal,
      args.entityName,
      args.entityType
    );
    if (resolved.error) {
      return { success: false, message: resolved.error };
    }
    if (!resolved.entity) {
      return {
        success: false,
        message: `Entity "${args.entityName}" not found`,
      };
    }

    const entity = resolved.entity;
    try {
      requireEntityType(registry, entity.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid entity type" };
    }
    const { name, aliases, notes, ...propertyUpdates } = args.updates;

    const dbUpdates: Record<string, unknown> = {};
    if (name !== undefined) {
      dbUpdates["name"] = name;
      dbUpdates["canonicalName"] = canonicalizeName(name);
    }
    if (aliases !== undefined) dbUpdates["aliases"] = normalizeAliases(aliases);
    if (notes !== undefined) dbUpdates["notes"] = notes;

    const existingProps = (entity.properties ?? {}) as Record<string, unknown>;
    const cleanPropUpdates = Object.fromEntries(
      Object.entries(propertyUpdates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(cleanPropUpdates).length > 0) {
      dbUpdates["properties"] = { ...existingProps, ...cleanPropUpdates };
    }

    await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].updateEntityMutation,
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
  handler: async (ctx, { projectId, toolArgs, actor, source: sourceContext }): Promise<{ success: boolean; relationshipId?: string; message: string }> => {
    const args = toolArgs as CreateRelationshipArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    try {
      requireRelationshipType(registry, args.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid relationship type" };
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) {
      return { success: false, message: sourceResult.error };
    }
    if (!sourceResult.entity) {
      return { success: false, message: `Source entity "${args.sourceName}" not found` };
    }

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) {
      return { success: false, message: targetResult.error };
    }
    if (!targetResult.entity) {
      return { success: false, message: `Target entity "${args.targetName}" not found` };
    }

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const existing = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (existing) {
      return {
        success: false,
        message: `Relationship ${args.sourceName} → ${args.type} → ${args.targetName} already exists`,
      };
    }

    const relId = await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].createRelationshipMutation,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
        bidirectional: args.bidirectional,
        strength: args.strength,
        notes: args.notes,
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
  handler: async (ctx, { projectId, toolArgs, actor, source: sourceContext }): Promise<{ success: boolean; relationshipId?: string; message: string }> => {
    const args = toolArgs as UpdateRelationshipArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(
      ctx,
      projectIdVal,
      actorInfo.actorUserId
    );
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    try {
      requireRelationshipType(registry, args.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid relationship type" };
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) {
      return { success: false, message: sourceResult.error };
    }
    if (!sourceResult.entity) {
      return { success: false, message: `Source entity "${args.sourceName}" not found` };
    }

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) {
      return { success: false, message: targetResult.error };
    }
    if (!targetResult.entity) {
      return { success: false, message: `Target entity "${args.targetName}" not found` };
    }

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const rel = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (!rel) {
      return {
        success: false,
        message: `Relationship ${args.sourceName} → ${args.type} → ${args.targetName} not found`,
      };
    }

    await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].updateRelationshipMutation,
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
  ): Promise<{ success: boolean; entityId?: string; message: string }> => {
    const args = toolArgs as CreateNodeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    try {
      requireEntityType(registry, args.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid node type" };
    }

    const resolved = await resolveEntityByName(ctx, projectIdVal, args.name, args.type);
    if (resolved.error) {
      return { success: false, message: resolved.error };
    }
    if (resolved.entity) {
      return {
        success: false,
        message: `Node "${args.name}" already exists as ${resolved.entity.type}`,
      };
    }

    const entityId = await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].createEntityMutation,
      {
        projectId: projectIdVal,
        type: args.type,
        name: args.name,
        aliases: args.aliases,
        properties: args.properties ?? {},
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
  ): Promise<{ success: boolean; entityId?: string; message: string }> => {
    const args = toolArgs as UpdateNodeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);

    const resolved = await resolveEntityByName(ctx, projectIdVal, args.nodeName, args.nodeType);
    if (resolved.error) {
      return { success: false, message: resolved.error };
    }
    if (!resolved.entity) {
      return { success: false, message: `Node "${args.nodeName}" not found` };
    }

    const entity = resolved.entity;
    try {
      requireEntityType(registry, entity.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid node type" };
    }

    const { name, aliases, notes, properties } = args.updates;

    const dbUpdates: Record<string, unknown> = {};
    if (name !== undefined) {
      dbUpdates["name"] = name;
      dbUpdates["canonicalName"] = canonicalizeName(name);
    }
    if (aliases !== undefined) dbUpdates["aliases"] = normalizeAliases(aliases);
    if (notes !== undefined) dbUpdates["notes"] = notes;

    if (properties !== undefined && typeof properties === "object" && properties !== null) {
      const existingProps = (entity.properties ?? {}) as Record<string, unknown>;
      dbUpdates["properties"] = { ...existingProps, ...(properties as Record<string, unknown>) };
    }

    await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].updateEntityMutation,
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
  ): Promise<{ success: boolean; relationshipId?: string; message: string }> => {
    const args = toolArgs as CreateEdgeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    try {
      requireRelationshipType(registry, args.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid edge type" };
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) return { success: false, message: sourceResult.error };
    if (!sourceResult.entity) return { success: false, message: `Source node "${args.sourceName}" not found` };

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) return { success: false, message: targetResult.error };
    if (!targetResult.entity) return { success: false, message: `Target node "${args.targetName}" not found` };

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const existing = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (existing) {
      return {
        success: false,
        message: `Edge ${args.sourceName} → ${args.type} → ${args.targetName} already exists`,
      };
    }

    const relId = await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].createRelationshipMutation,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
        bidirectional: args.bidirectional,
        strength: args.strength,
        notes: args.notes,
        metadata: args.metadata,
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
  ): Promise<{ success: boolean; relationshipId?: string; message: string }> => {
    const args = toolArgs as UpdateEdgeArgs;
    const projectIdVal = projectId as Id<"projects">;
    const actorInfo = resolveActor(actor as ToolActorContext | undefined);

    const accessError = await getProjectAccessError(ctx, projectIdVal, actorInfo.actorUserId);
    if (accessError) {
      return { success: false, message: accessError };
    }

    const registry = await getResolvedRegistry(ctx, projectIdVal);
    try {
      requireRelationshipType(registry, args.type);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Invalid edge type" };
    }

    const sourceResult = await resolveEntityByName(ctx, projectIdVal, args.sourceName);
    if (sourceResult.error) return { success: false, message: sourceResult.error };
    if (!sourceResult.entity) return { success: false, message: `Source node "${args.sourceName}" not found` };

    const targetResult = await resolveEntityByName(ctx, projectIdVal, args.targetName);
    if (targetResult.error) return { success: false, message: targetResult.error };
    if (!targetResult.entity) return { success: false, message: `Target node "${args.targetName}" not found` };

    const source = sourceResult.entity;
    const target = targetResult.entity;

    const rel = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findRelationship,
      {
        projectId: projectIdVal,
        sourceId: source._id,
        targetId: target._id,
        type: args.type,
      }
    );

    if (!rel) {
      return {
        success: false,
        message: `Edge ${args.sourceName} → ${args.type} → ${args.targetName} not found`,
      };
    }

    await ctx.runMutation(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].updateRelationshipMutation,
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
