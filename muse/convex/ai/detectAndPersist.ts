import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";

interface PersistedEntity {
  id: string;
  name: string;
  type: string;
  created: boolean;
}

function canonicalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function mergeAliases(existing: string[], incoming: string[], primary: string): string[] {
  const values = [primary, ...existing, ...incoming]
    .map((alias) => alias.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const alias of values) {
    const key = canonicalizeName(alias);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(alias);
  }

  return result;
}

/**
 * Public action to detect entities and persist them to the entities table.
 * Uses E2E_MOCK_AI when enabled in detect.ts for deterministic results.
 */
export const detectAndPersistEntitiesPublic = action({
  args: {
    projectId: v.id("projects"),
    text: v.string(),
    entityTypes: v.optional(v.array(v.string())),
    minConfidence: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ entities: PersistedEntity[]; stats: { totalFound: number; byType: Record<string, number> } }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    await ctx.runQuery(api.projects.get, { id: args.projectId });

    const detection = await ctx.runAction(internal.ai.detect.detectEntities, {
      text: args.text,
      projectId: args.projectId,
      userId: identity.subject,
      entityTypes: args.entityTypes,
      minConfidence: args.minConfidence,
    });

    const persisted: PersistedEntity[] = [];

    for (const entity of detection.entities) {
      const matches = await ctx.runQuery(api.entities.searchByName, {
        projectId: args.projectId,
        query: entity.name,
        limit: 8,
      });

      const canonical = canonicalizeName(entity.name);
      const existing = matches.find((match) => {
        if (canonicalizeName(match.name) === canonical) {
          return true;
        }
        return match.aliases?.some((alias) => canonicalizeName(alias) === canonical) ?? false;
      });

      if (existing) {
        const aliases = mergeAliases(
          existing.aliases ?? [],
          [entity.name, ...(entity.aliases ?? [])],
          existing.name
        );
        const properties = {
          ...(existing.properties ?? {}),
          ...(entity.properties ?? {}),
        };

        await ctx.runMutation(api.entities.update, {
          id: existing._id,
          aliases,
          properties,
        });

        persisted.push({
          id: existing._id,
          name: existing.name,
          type: existing.type,
          created: false,
        });
      } else {
        const id = await ctx.runMutation(api.entities.create, {
          projectId: args.projectId,
          type: entity.type,
          name: entity.name,
          aliases: entity.aliases ?? [],
          properties: entity.properties ?? {},
        });

        persisted.push({
          id,
          name: entity.name,
          type: entity.type,
          created: true,
        });
      }
    }

    return {
      entities: persisted,
      stats: detection.stats,
    };
  },
});
