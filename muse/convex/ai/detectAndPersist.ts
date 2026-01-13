import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { canonicalizeName } from "../lib/canonicalize";

interface PersistedEntity {
  id: string;
  name: string;
  type: string;
  created: boolean;
}

interface DetectionWarning {
  type: "conflicting_type";
  message: string;
  canonicalName: string;
  types: string[];
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
  handler: async (
    ctx,
    args
  ): Promise<{
    entities: PersistedEntity[];
    stats: { totalFound: number; byType: Record<string, number> };
    warnings?: DetectionWarning[];
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // @ts-ignore Deep type instantiation
    await ctx.runQuery(api.projects.get, { id: args.projectId });

    const detection = await ctx.runAction(internal.ai.detect.detectEntities, {
      text: args.text,
      projectId: args.projectId,
      userId: identity.subject,
      entityTypes: args.entityTypes,
      minConfidence: args.minConfidence,
    });

    const typeByCanonical = new Map<string, Set<string>>();
    for (const entity of detection.entities) {
      const canonical = canonicalizeName(entity.name);
      const types = typeByCanonical.get(canonical) ?? new Set<string>();
      types.add(entity.type);
      typeByCanonical.set(canonical, types);
    }

    const warnings: DetectionWarning[] = [];
    for (const [canonicalName, types] of typeByCanonical.entries()) {
      if (types.size > 1) {
        warnings.push({
          type: "conflicting_type",
          canonicalName,
          types: Array.from(types),
          message: `Detected multiple entity types for "${canonicalName}": ${Array.from(types).join(", ")}`,
        });
      }
    }

    const { created, updated } = await ctx.runMutation(api.entities.upsertDetectedEntities, {
      projectId: args.projectId,
      detected: detection.entities.map(
        (entity: {
          name: string;
          type: string;
          aliases?: string[];
          properties?: Record<string, unknown>;
        }) => ({
          name: entity.name,
          type: entity.type,
          aliases: entity.aliases ?? [],
          properties: entity.properties ?? {},
        })
      ),
    });

    const persisted: PersistedEntity[] = [
      ...created.map((entity: { id: string; name: string; type: string }) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        created: true,
      })),
      ...updated.map((entity: { id: string; name: string; type: string }) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        created: false,
      })),
    ];

    return {
      entities: persisted,
      stats: detection.stats,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});
