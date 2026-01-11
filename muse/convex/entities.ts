/**
 * Convex Entities Functions
 *
 * CRUD operations for entities (characters, locations, items, etc.)
 * Real-time subscriptions for Project Graph updates.
 */

import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyEntityAccess } from "./lib/auth";
import { canonicalizeName } from "./lib/canonicalize";
import {
  getEntityTypeDef,
  resolveRegistry,
  validateEntityProperties,
  type ProjectTypeRegistryResolved,
  type ProjectTypeRegistryOverride,
} from "./lib/typeRegistry";
import { DEFAULT_TEMPLATE_ID, type ProjectTemplateId } from "./lib/projectTemplates";

// ============================================================
// Helpers
// ============================================================

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

function mergeAliases(existing: string[], incoming: string[], primary: string): string[] {
  return normalizeAliases([primary, ...existing, ...incoming]);
}

async function getResolvedRegistryForProject(
  ctx: MutationCtx,
  projectId: Id<"projects">
): Promise<ProjectTypeRegistryResolved> {
  const project = await ctx.db.get(projectId);
  const templateId = (project?.templateId ?? DEFAULT_TEMPLATE_ID) as ProjectTemplateId;

  const override = await ctx.db
    .query("projectTypeRegistry")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();

  return resolveRegistry(templateId, override as ProjectTypeRegistryOverride | null);
}

// ============================================================
// QUERIES
// ============================================================

/**
 * List all entities for a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { projectId, type, limit = 100 } = args;

    // Verify user has access to this project
    await verifyProjectAccess(ctx, projectId);

    let q = ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId));

    if (type) {
      q = ctx.db
        .query("entities")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", projectId).eq("type", type)
        );
    }

    const entities = await q.take(limit);

    return entities;
  },
});

/**
 * Get a single entity by ID
 */
export const get = query({
  args: {
    id: v.id("entities"),
  },
  handler: async (ctx, args) => {
    // Verify user has access via entity's project
    await verifyEntityAccess(ctx, args.id);
    return await ctx.db.get(args.id);
  },
});

/**
 * Search entities by name (prefix match)
 */
export const searchByName = query({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { projectId, query: searchQuery, limit = 20 } = args;

    // Verify user has access to this project
    await verifyProjectAccess(ctx, projectId);

    const lowerQuery = searchQuery.toLowerCase();

    // Get all entities for project (Convex doesn't have LIKE queries)
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Filter by name/aliases client-side
    const matches = entities.filter((entity) => {
      const nameMatch = entity.name.toLowerCase().includes(lowerQuery);
      const aliasMatch = entity.aliases.some((alias) =>
        alias.toLowerCase().includes(lowerQuery)
      );
      return nameMatch || aliasMatch;
    });

    return matches.slice(0, limit);
  },
});

/**
 * Get a single entity by canonical name and type.
 */
export const getByCanonical = query({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    canonicalName: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const canonicalName = canonicalizeName(args.canonicalName);

    return await ctx.db
      .query("entities")
      .withIndex("by_project_type_canonical", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("type", args.type)
          .eq("canonicalName", canonicalName)
      )
      .first();
  },
});

/**
 * Get entities with their relationships (for World Graph)
 */
export const listWithRelationships = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { projectId } = args;

    // Verify user has access to this project
    await verifyProjectAccess(ctx, projectId);

    // Get all entities
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Get all relationships
    const relationships = await ctx.db
      .query("relationships")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return {
      entities,
      relationships,
    };
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new entity
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    properties: v.optional(v.any()),
    notes: v.optional(v.string()),
    portraitUrl: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    visibleIn: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const registry = await getResolvedRegistryForProject(ctx, args.projectId);
    const def = getEntityTypeDef(registry, args.type);
    if (!def) {
      throw new Error(`INVALID_TYPE: ${args.type}`);
    }

    const propertiesResult = validateEntityProperties(def, args.properties ?? {});
    if (!propertiesResult.ok) {
      throw new Error(`SCHEMA_VALIDATION_FAILED: ${propertiesResult.error.message}`);
    }

    const now = Date.now();
    const canonicalName = canonicalizeName(args.name);
    const aliases = normalizeAliases(args.aliases ?? []);

    const id = await ctx.db.insert("entities", {
      projectId: args.projectId,
      type: args.type,
      name: args.name,
      canonicalName,
      aliases,
      properties: propertiesResult.value,
      notes: args.notes,
      portraitUrl: args.portraitUrl,
      icon: args.icon,
      color: args.color,
      visibleIn: args.visibleIn,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
      projectId: args.projectId,
      targetType: "entity",
      targetId: id,
    });

    return id;
  },
});

/**
 * Update an existing entity
 */
export const update = mutation({
  args: {
    id: v.id("entities"),
    name: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    properties: v.optional(v.any()),
    notes: v.optional(v.string()),
    portraitUrl: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    visibleIn: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Verify user has access via entity's project
    await verifyEntityAccess(ctx, id);

    const entity = await ctx.db.get(id);
    if (!entity) {
      throw new Error("Entity not found");
    }

    const registry = await getResolvedRegistryForProject(ctx, entity.projectId);
    const def = getEntityTypeDef(registry, entity.type);
    if (!def) {
      throw new Error(`INVALID_TYPE: ${entity.type}`);
    }

    const normalizedUpdates: Record<string, unknown> = { ...updates };
    if (updates.aliases) {
      normalizedUpdates["aliases"] = normalizeAliases(updates.aliases);
    }
    if (updates.name) {
      normalizedUpdates["canonicalName"] = canonicalizeName(updates.name);
    }
    const nextProperties = updates.properties ?? entity.properties ?? {};
    const propertiesResult = validateEntityProperties(def, nextProperties);
    if (!propertiesResult.ok) {
      throw new Error(`SCHEMA_VALIDATION_FAILED: ${propertiesResult.error.message}`);
    }
    if (updates.properties !== undefined) {
      normalizedUpdates["properties"] = propertiesResult.value;
    }

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(normalizedUpdates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
      projectId: entity.projectId,
      targetType: "entity",
      targetId: entity._id,
    });

    return id;
  },
});

/**
 * Upsert entities detected from text, merging aliases and properties.
 */
export const upsertDetectedEntities = mutation({
  args: {
    projectId: v.id("projects"),
    detected: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        aliases: v.optional(v.array(v.string())),
        properties: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const registry = await getResolvedRegistryForProject(ctx, args.projectId);
    const deduped = new Map<
      string,
      {
        name: string;
        type: string;
        canonicalName: string;
        aliases: string[];
        properties: Record<string, unknown>;
      }
    >();

    for (const entity of args.detected) {
      const canonicalName = canonicalizeName(entity.name);
      const key = `${entity.type}:${canonicalName}`;
      const existing = deduped.get(key);
      const aliases = normalizeAliases(entity.aliases ?? []);
      const properties = (entity.properties ?? {}) as Record<string, unknown>;

      if (existing) {
        existing.aliases = mergeAliases(existing.aliases, aliases, existing.name);
        existing.properties = { ...existing.properties, ...properties };
        continue;
      }

      deduped.set(key, {
        name: entity.name,
        type: entity.type,
        canonicalName,
        aliases,
        properties,
      });
    }

    const created: Array<{ id: Id<"entities">; name: string; type: string }> = [];
    const updated: Array<{ id: Id<"entities">; name: string; type: string }> = [];
    const now = Date.now();
    const unmatchedByType = new Map<
      string,
      Array<{
        name: string;
        type: string;
        canonicalName: string;
        aliases: string[];
        properties: Record<string, unknown>;
      }>
    >();

    for (const entity of deduped.values()) {
      const def = getEntityTypeDef(registry, entity.type);
      if (!def) {
        throw new Error(`INVALID_TYPE: ${entity.type}`);
      }
      const existing = await ctx.db
        .query("entities")
        .withIndex("by_project_type_canonical", (q) =>
          q
            .eq("projectId", args.projectId)
            .eq("type", entity.type)
            .eq("canonicalName", entity.canonicalName)
        )
        .first();

      if (existing) {
        const aliases = mergeAliases(
          existing.aliases ?? [],
          [entity.name, ...entity.aliases],
          existing.name
        );
        const properties = {
          ...(existing.properties ?? {}),
          ...entity.properties,
        };
        const propertiesResult = validateEntityProperties(def, properties);
        if (!propertiesResult.ok) {
          throw new Error(
            `SCHEMA_VALIDATION_FAILED: ${propertiesResult.error.message}`
          );
        }
        const canonicalName = existing.canonicalName ?? canonicalizeName(existing.name);

        await ctx.db.patch(existing._id, {
          aliases,
          properties: propertiesResult.value,
          canonicalName,
          updatedAt: now,
        });

        await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
          projectId: existing.projectId,
          targetType: "entity",
          targetId: existing._id,
        });

        updated.push({ id: existing._id, name: existing.name, type: existing.type });
      } else {
        const pending = unmatchedByType.get(entity.type) ?? [];
        pending.push(entity);
        unmatchedByType.set(entity.type, pending);
      }
    }

    for (const [type, pendingEntities] of unmatchedByType.entries()) {
      const candidates = await ctx.db
        .query("entities")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", args.projectId).eq("type", type)
        )
        .collect();

      const aliasLookup = new Map<string, (typeof candidates)[number]>();
      for (const candidate of candidates) {
        const keys = new Set<string>();
        keys.add(canonicalizeName(candidate.name));
        for (const alias of candidate.aliases ?? []) {
          keys.add(canonicalizeName(alias));
        }
        for (const key of keys) {
          if (!aliasLookup.has(key)) {
            aliasLookup.set(key, candidate);
          }
        }
      }

      for (const entity of pendingEntities) {
        const def = getEntityTypeDef(registry, entity.type);
        if (!def) {
          throw new Error(`INVALID_TYPE: ${entity.type}`);
        }
        const existing = aliasLookup.get(entity.canonicalName);

        if (existing) {
          const aliases = mergeAliases(
            existing.aliases ?? [],
            [entity.name, ...entity.aliases],
            existing.name
          );
          const properties = {
            ...(existing.properties ?? {}),
            ...entity.properties,
          };
          const propertiesResult = validateEntityProperties(def, properties);
          if (!propertiesResult.ok) {
            throw new Error(
              `SCHEMA_VALIDATION_FAILED: ${propertiesResult.error.message}`
            );
          }
          const canonicalName = existing.canonicalName ?? canonicalizeName(existing.name);

          await ctx.db.patch(existing._id, {
            aliases,
            properties: propertiesResult.value,
            canonicalName,
            updatedAt: now,
          });

          await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
            projectId: existing.projectId,
            targetType: "entity",
            targetId: existing._id,
          });

          updated.push({ id: existing._id, name: existing.name, type: existing.type });
          continue;
        }

        const propertiesResult = validateEntityProperties(def, entity.properties);
        if (!propertiesResult.ok) {
          throw new Error(`SCHEMA_VALIDATION_FAILED: ${propertiesResult.error.message}`);
        }

        const id = await ctx.db.insert("entities", {
          projectId: args.projectId,
          type: entity.type,
          name: entity.name,
          canonicalName: entity.canonicalName,
          aliases: entity.aliases,
          properties: propertiesResult.value,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
          projectId: args.projectId,
          targetType: "entity",
          targetId: id,
        });

        created.push({ id, name: entity.name, type: entity.type });
      }
    }

    return { created, updated };
  },
});

/**
 * Delete an entity and its relationships
 */
export const remove = mutation({
  args: {
    id: v.id("entities"),
  },
  handler: async (ctx, args) => {
    const { id } = args;

    // Verify user has access via entity's project
    await verifyEntityAccess(ctx, id);

    // Delete all relationships involving this entity
    const sourceRelationships = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", id))
      .collect();

    const targetRelationships = await ctx.db
      .query("relationships")
      .withIndex("by_target", (q) => q.eq("targetId", id))
      .collect();

    for (const rel of [...sourceRelationships, ...targetRelationships]) {
      await ctx.db.delete(rel._id);
    }

    // Delete all mentions of this entity
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_entity", (q) => q.eq("entityId", id))
      .collect();

    for (const mention of mentions) {
      await ctx.db.delete(mention._id);
    }

    // Delete the entity itself
    await ctx.db.delete(id);

    return id;
  },
});

/**
 * Bulk create entities (for import/migration)
 */
export const bulkCreate = mutation({
  args: {
    projectId: v.id("projects"),
    entities: v.array(
      v.object({
        type: v.string(),
        name: v.string(),
        aliases: v.optional(v.array(v.string())),
        properties: v.optional(v.any()),
        notes: v.optional(v.string()),
        supabaseId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const registry = await getResolvedRegistryForProject(ctx, args.projectId);
    const now = Date.now();
    const ids: Id<"entities">[] = [];

    for (const entity of args.entities) {
      const def = getEntityTypeDef(registry, entity.type);
      if (!def) {
        throw new Error(`INVALID_TYPE: ${entity.type}`);
      }
      const propertiesResult = validateEntityProperties(def, entity.properties ?? {});
      if (!propertiesResult.ok) {
        throw new Error(`SCHEMA_VALIDATION_FAILED: ${propertiesResult.error.message}`);
      }
      const canonicalName = canonicalizeName(entity.name);
      const id = await ctx.db.insert("entities", {
        projectId: args.projectId,
        type: entity.type,
        name: entity.name,
        canonicalName,
        aliases: normalizeAliases(entity.aliases ?? []),
        properties: propertiesResult.value,
        notes: entity.notes,
        supabaseId: entity.supabaseId,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }

    return ids;
  },
});
