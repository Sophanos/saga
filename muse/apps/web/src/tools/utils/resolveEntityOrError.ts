import type { Entity, EntityType } from "@mythos/core";
import type { ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";

/**
 * Result of resolveEntityOrError - either a resolved entity or an error result.
 */
export type EntityOrError<T> =
  | { ok: true; entity: Entity }
  | { ok: false; errorResult: ToolExecutionResult<T> };

/**
 * Resolves an entity by name with standardized error handling.
 *
 * Encapsulates the common pattern of:
 * 1. Looking up an entity by name (optionally filtered by type)
 * 2. Handling the ambiguous match case with proper error message
 * 3. Returning either the entity or a failed ToolExecutionResult
 *
 * @param name - Entity name to resolve
 * @param entities - Map of all entities
 * @param type - Optional entity type filter
 * @param label - Optional label for error messages (e.g., "source", "target")
 *
 * @example
 * ```ts
 * const result = resolveEntityOrError<DeleteEntityResult>(
 *   args.entityName,
 *   ctx.entities,
 *   args.entityType
 * );
 * if (!result.ok) return result.errorResult;
 * const entity = result.entity;
 * ```
 */
export function resolveEntityOrError<T>(
  name: string,
  entities: Map<string, Entity>,
  type?: EntityType,
  label?: string
): EntityOrError<T> {
  const resolution = resolveEntityByName(name, entities, type);

  if (!resolution.found) {
    const prefix = label ? `${label}: ` : "";

    if (resolution.candidates) {
      return {
        ok: false,
        errorResult: {
          success: false,
          error: `${prefix}Ambiguous: found ${resolution.candidates.length} entities named "${name}". Candidates: ${resolution.candidates.map((e) => `${e.name} (${e.type})`).join(", ")}`,
        },
      };
    }

    return {
      ok: false,
      errorResult: {
        success: false,
        error: `${prefix}${resolution.error ?? `Entity "${name}" not found`}`,
      },
    };
  }

  return { ok: true, entity: resolution.entity! };
}
