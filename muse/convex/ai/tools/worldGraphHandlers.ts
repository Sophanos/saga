/**
 * World Graph Tool Handlers - Server-side execution for entity/relationship tools
 */

import { v } from "convex/values";
import { internalAction, internalQuery, internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import type {
  CreateEntityArgs,
  UpdateEntityArgs,
  CreateRelationshipArgs,
  UpdateRelationshipArgs,
} from "./worldGraphTools";

// =============================================================================
// Internal Queries - Entity/Relationship Lookups
// =============================================================================

export const findEntityByName = internalQuery({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, name, type }) => {
    const lowerName = name.toLowerCase();

    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const matches = entities.filter((e) => {
      const nameMatch = e.name.toLowerCase() === lowerName;
      const aliasMatch = e.aliases.some((a) => a.toLowerCase() === lowerName);
      const typeMatch = !type || e.type === type;
      return (nameMatch || aliasMatch) && typeMatch;
    });

    return matches[0] ?? null;
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
    return await ctx.db.insert("entities", {
      projectId: args.projectId,
      type: args.type,
      name: args.name,
      aliases: args.aliases ?? [],
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

export const executeCreateEntity = internalAction({
  args: {
    projectId: v.string(),
    toolArgs: v.any(),
  },
  handler: async (ctx, { projectId, toolArgs }): Promise<{ success: boolean; entityId?: string; message: string }> => {
    const args = toolArgs as CreateEntityArgs;
    const projectIdVal = projectId as Id<"projects">;

    const existing = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findEntityByName,
      { projectId: projectIdVal, name: args.name, type: args.type }
    );

    if (existing) {
      return {
        success: false,
        message: `Entity "${args.name}" already exists as ${existing.type}`,
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
  },
  handler: async (ctx, { projectId, toolArgs }): Promise<{ success: boolean; entityId?: string; message: string }> => {
    const args = toolArgs as UpdateEntityArgs;
    const projectIdVal = projectId as Id<"projects">;

    const entity = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findEntityByName,
      { projectId: projectIdVal, name: args.entityName, type: args.entityType }
    );

    if (!entity) {
      return {
        success: false,
        message: `Entity "${args.entityName}" not found`,
      };
    }

    const { name, aliases, notes, ...propertyUpdates } = args.updates;

    const dbUpdates: Record<string, unknown> = {};
    if (name !== undefined) dbUpdates["name"] = name;
    if (aliases !== undefined) dbUpdates["aliases"] = aliases;
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

    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );

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
  },
  handler: async (ctx, { projectId, toolArgs }): Promise<{ success: boolean; relationshipId?: string; message: string }> => {
    const args = toolArgs as CreateRelationshipArgs;
    const projectIdVal = projectId as Id<"projects">;

    const source = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findEntityByName,
      { projectId: projectIdVal, name: args.sourceName }
    );

    if (!source) {
      return { success: false, message: `Source entity "${args.sourceName}" not found` };
    }

    const target = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findEntityByName,
      { projectId: projectIdVal, name: args.targetName }
    );

    if (!target) {
      return { success: false, message: `Target entity "${args.targetName}" not found` };
    }

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
  },
  handler: async (ctx, { projectId, toolArgs }): Promise<{ success: boolean; relationshipId?: string; message: string }> => {
    const args = toolArgs as UpdateRelationshipArgs;
    const projectIdVal = projectId as Id<"projects">;

    const source = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findEntityByName,
      { projectId: projectIdVal, name: args.sourceName }
    );

    if (!source) {
      return { success: false, message: `Source entity "${args.sourceName}" not found` };
    }

    const target = await ctx.runQuery(
      // @ts-expect-error Deep types
      internal["ai/tools/worldGraphHandlers"].findEntityByName,
      { projectId: projectIdVal, name: args.targetName }
    );

    if (!target) {
      return { success: false, message: `Target entity "${args.targetName}" not found` };
    }

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

    return {
      success: true,
      relationshipId: rel._id as string,
      message: `Updated relationship ${args.sourceName} → ${args.type} → ${args.targetName}: ${updatedFields.join(", ")}`,
    };
  },
});
