/**
 * Convex → Core Project Mapper
 *
 * Maps Convex project records to Core Project types.
 * No Convex imports - uses a generic "ConvexProjectLike" input shape.
 */

import {
  looseProjectSchema,
  projectTemplateIdSchema,
  type LooseProject,
  type ProjectTemplateId,
} from "../../schema/project.schema";

/**
 * Shape of a Convex project record (without Convex-specific imports).
 * Convex IDs are strings at runtime, just branded for type checking.
 */
export interface ConvexProjectLike {
  _id: string;
  name: string;
  description?: string | null;
  templateId?: string | null;
  templateOverrides?: unknown | null;
  metadata?: unknown | null;
  settings?: unknown | null;
  genre?: string | null;
  styleConfig?: unknown | null;
  linterConfig?: unknown | null;
  createdAt: number;
  updatedAt: number;
}

const VALID_TEMPLATE_IDS = new Set<ProjectTemplateId>([
  "writer",
  "product",
  "engineering",
  "design",
  "comms",
  "custom",
]);

function normalizeTemplateId(templateId: string | null | undefined): ProjectTemplateId {
  if (!templateId) return "writer";
  if (VALID_TEMPLATE_IDS.has(templateId as ProjectTemplateId)) {
    return templateId as ProjectTemplateId;
  }
  return "writer";
}

/**
 * Maps a Convex project record to a Core LooseProject.
 *
 * - templateId defaults to "writer" if missing/null
 * - createdAt/updatedAt numbers become Dates
 * - Writer-only legacy fields (genre, styleConfig, linterConfig) are folded
 *   into config only when templateId === "writer"
 */
export function mapConvexProjectToCoreProject(p: ConvexProjectLike): LooseProject {
  const templateId = normalizeTemplateId(p.templateId);

  // Build config based on template type
  let config: Record<string, unknown> = {};

  if (templateId === "writer") {
    // For writer templates, merge legacy fields into config
    const styleConfig =
      p.styleConfig && typeof p.styleConfig === "object"
        ? (p.styleConfig as Record<string, unknown>)
        : {};

    config = {
      ...styleConfig,
      ...(p.genre ? { genre: p.genre } : {}),
      ...(p.linterConfig && typeof p.linterConfig === "object"
        ? { linterConfig: p.linterConfig }
        : {}),
    };
  }
  // Non-writer templates get empty config (their templates define entity/relationship types, not config)

  const result = looseProjectSchema.parse({
    id: p._id,
    name: p.name,
    description: p.description ?? undefined,
    templateId,
    templateOverrides: p.templateOverrides ?? undefined,
    metadata: p.metadata ?? undefined,
    settings: p.settings ?? undefined,
    config,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });

  return result;
}

/**
 * Creates a minimal Core project from bootstrap result + input data.
 * Use when you don't want to do an extra fetch after project creation.
 */
export function createProjectFromBootstrap(params: {
  projectId: string;
  name: string;
  description?: string;
  templateId?: string;
  templateOverrides?: unknown;
  metadata?: unknown;
  settings?: unknown;
}): LooseProject {
  const templateId = normalizeTemplateId(params.templateId);

  return looseProjectSchema.parse({
    id: params.projectId,
    name: params.name,
    description: params.description,
    templateId,
    templateOverrides: params.templateOverrides,
    metadata: params.metadata,
    settings: params.settings,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export { projectTemplateIdSchema, type ProjectTemplateId };
