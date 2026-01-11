import { z } from "zod";

// =============================================================================
// Project Template IDs (aligned with Convex)
// =============================================================================

/** Convex workspace-domain template IDs */
export const projectTemplateIdSchema = z.enum([
  "writer",
  "product",
  "engineering",
  "design",
  "comms",
  "custom",
]);

export type ProjectTemplateId = z.infer<typeof projectTemplateIdSchema>;

export const DEFAULT_PROJECT_TEMPLATE_ID: ProjectTemplateId = "writer";

// =============================================================================
// Writer Preset IDs (legacy genre/content-model presets)
// =============================================================================

/** Writer-specific preset IDs for genre/content-model configuration */
export const writerPresetIdSchema = z.enum([
  "epic_fantasy",
  "wizarding_world",
  "dnd_campaign",
  "manga_novel",
  "literary_fiction",
  "science_fiction",
  "horror",
  "romance",
  "mystery_thriller",
  "screenplay",
  "webnovel_serial",
  "visual_novel",
  "comics_graphic_novel",
  "blank",
]);

export type WriterPresetId = z.infer<typeof writerPresetIdSchema>;

/** @deprecated Use projectTemplateIdSchema instead */
export const templateIdSchema = writerPresetIdSchema;
/** @deprecated Use ProjectTemplateId instead */
export type TemplateId = WriterPresetId;

// =============================================================================
// Genre & Style
// =============================================================================

export const genreSchema = z.enum([
  "high_fantasy",
  "urban_fantasy",
  "science_fiction",
  "horror",
  "mystery",
  "romance",
  "thriller",
  "literary",
  "manga_shounen",
  "manga_seinen",
  "manga_shoujo",
  "manga_josei",
  "litrpg",
  "progression_fantasy",
  "grimdark",
  "slice_of_life",
]);

export const styleModeSchema = z.enum([
  "hemingway",
  "tolkien",
  "manga",
  "noir",
  "minimalist",
  "purple_prose",
]);

// =============================================================================
// Linter Configuration
// =============================================================================

export const linterSeveritySchema = z.enum([
  "off",
  "info",
  "warning",
  "error",
  "critical",
]);

export const linterConfigSchema = z.object({
  nameConsistency: linterSeveritySchema.default("error"),
  visualConsistency: linterSeveritySchema.default("warning"),
  locationConsistency: linterSeveritySchema.default("warning"),
  timelineConsistency: linterSeveritySchema.default("info"),
  archetypeDeviation: linterSeveritySchema.default("warning"),
  powerScaling: linterSeveritySchema.default("info"),
  pacingFlat: linterSeveritySchema.default("info"),
  dialogueLength: linterSeveritySchema.default("off"),
  adverbUsage: linterSeveritySchema.default("off"),
  passiveVoice: linterSeveritySchema.default("off"),
  showDontTell: linterSeveritySchema.default("off"),
  symbolismConsistency: linterSeveritySchema.default("off"),
});

// =============================================================================
// Memory Controls
// =============================================================================

const memoryPolicyOverrideSchema = z.object({
  halfLife: z.string().optional(),
  ttl: z.string().optional(),
});

const memoryCategoryControlsSchema = z.object({
  enabled: z.boolean().optional(),
  maxAgeDays: z.number().optional(),
});

const memoryControlsSchema = z.object({
  categories: z
    .object({
      decision: memoryCategoryControlsSchema.optional(),
      style: memoryCategoryControlsSchema.optional(),
      preference: memoryCategoryControlsSchema.optional(),
      session: memoryCategoryControlsSchema.optional(),
    })
    .optional(),
  policyOverrides: z
    .object({
      decision: memoryPolicyOverrideSchema.optional(),
      style: memoryPolicyOverrideSchema.optional(),
      preference: memoryPolicyOverrideSchema.optional(),
      session: memoryPolicyOverrideSchema.optional(),
    })
    .optional(),
  injectionBudgets: z
    .object({
      decisions: z.number().optional(),
      style: z.number().optional(),
      preferences: z.number().optional(),
      session: z.number().optional(),
    })
    .optional(),
  recencyWeight: z.number().min(0).max(1).optional(),
});

// =============================================================================
// Arc Templates
// =============================================================================

export const arcTemplateSchema = z.enum([
  "heros_journey",
  "three_act",
  "five_act",
  "kishotenketsu",
  "tragic_fall",
  "save_the_cat",
  "dan_harmon_circle",
  "freeform",
]);

// =============================================================================
// UI Modules
// =============================================================================

export const uiModuleSchema = z.enum([
  "manifest",
  "console",
  "hud",
  "chat",
  "linter",
  "dynamics",
  "coach",
  "history",
  "editor",
  "project_graph",
  "map",
  "timeline",
  "codex",
  "storyboard",
  "encounter",
  "initiative",
  "stat_blocks",
  "loot",
  "session_notes",
  "outline",
  "character_arcs",
  "scene_beats",
]);

// =============================================================================
// Template Overrides
// =============================================================================

export const templateOverridesSchema = z.object({
  customEntityKinds: z.array(z.any()).optional(),
  disabledEntityKinds: z.array(z.string()).optional(),
  customRelationshipKinds: z.array(z.any()).optional(),
  customDocumentKinds: z.array(z.any()).optional(),
  uiModuleOverrides: z.record(uiModuleSchema, z.boolean()).optional(),
});

// =============================================================================
// Template-specific Config Schemas (discriminated union approach)
// =============================================================================

/** Writer-specific project config with genre, style, linter settings */
export const writerConfigSchema = z.object({
  genre: genreSchema.optional(),
  subGenres: z.array(genreSchema).optional(),
  writerPresetId: writerPresetIdSchema.optional(),
  styleMode: styleModeSchema.default("manga"),
  guardrails: z
    .object({
      plot: z.enum(["no_plot_generation", "suggestions_only", "allow_generation"]).default("no_plot_generation"),
      edits: z.enum(["proofread_only", "line_edits", "rewrite"]).default("proofread_only"),
      strictness: z.enum(["low", "medium", "high"]).default("medium"),
      no_judgement_mode: z.boolean().default(true),
    })
    .optional(),
  smartMode: z
    .object({
      level: z.enum(["off", "balanced", "adaptive"]).default("balanced"),
      learnedStyleMaxItems: z.number().optional(),
      learnedStyleWeight: z.number().min(0).max(1).optional(),
    })
    .optional(),
  arcTemplate: arcTemplateSchema.default("three_act"),
  linterConfig: linterConfigSchema.default({}),
  memoryControls: memoryControlsSchema.optional(),
  customRules: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        pattern: z.string().optional(),
        severity: linterSeveritySchema,
      })
    )
    .optional(),
  targets: z
    .object({
      chapterWordCount: z.number().optional(),
      totalWordCount: z.number().optional(),
    })
    .optional(),
});

/** Generic empty config for non-writer templates */
export const emptyConfigSchema = z.object({}).default({});

/** @deprecated Use writerConfigSchema or emptyConfigSchema based on templateId */
export const projectConfigSchema = writerConfigSchema;

// =============================================================================
// Base Project Fields
// =============================================================================

const baseProjectFields = {
  id: z.string(),
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  templateOverrides: templateOverridesSchema.optional(),
  metadata: z.unknown().optional(),
  settings: z.unknown().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
};

// =============================================================================
// Template-specific Project Schemas (discriminated union)
// =============================================================================

export const writerProjectSchema = z.object({
  ...baseProjectFields,
  templateId: z.literal("writer").default("writer"),
  config: writerConfigSchema.default({}),
});

export const productProjectSchema = z.object({
  ...baseProjectFields,
  templateId: z.literal("product"),
  config: emptyConfigSchema,
});

export const engineeringProjectSchema = z.object({
  ...baseProjectFields,
  templateId: z.literal("engineering"),
  config: emptyConfigSchema,
});

export const designProjectSchema = z.object({
  ...baseProjectFields,
  templateId: z.literal("design"),
  config: emptyConfigSchema,
});

export const commsProjectSchema = z.object({
  ...baseProjectFields,
  templateId: z.literal("comms"),
  config: emptyConfigSchema,
});

export const customProjectSchema = z.object({
  ...baseProjectFields,
  templateId: z.literal("custom"),
  config: emptyConfigSchema,
});

/** Discriminated union of all project types by templateId */
export const projectSchema = z.discriminatedUnion("templateId", [
  writerProjectSchema,
  productProjectSchema,
  engineeringProjectSchema,
  designProjectSchema,
  commsProjectSchema,
  customProjectSchema,
]);

// =============================================================================
// Loose Project Schema (for partial/input states)
// =============================================================================

/**
 * Loose project schema that accepts any valid templateId and flexible config.
 * Use this for store state where projects may be partially loaded.
 * Config allows optional writer fields for backwards compatibility.
 */
export const looseProjectSchema = z.object({
  ...baseProjectFields,
  templateId: projectTemplateIdSchema.default("writer"),
  config: writerConfigSchema.partial().default({}),
});

// =============================================================================
// Document Types
// =============================================================================

/** Writer-specific document types (kept for backwards compatibility) */
export const writerDocumentTypeSchema = z.enum([
  "chapter",
  "scene",
  "note",
  "outline",
  "worldbuilding",
]);

/** Open-ended document type to support all templates */
export const documentTypeSchema = z.string();

export const documentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentId: z.string().optional(),
  type: documentTypeSchema,
  title: z.string().optional(),
  content: z.any(),
  orderIndex: z.number().int().default(0),
  wordCount: z.number().int().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Genre = z.infer<typeof genreSchema>;
export type StyleMode = z.infer<typeof styleModeSchema>;
export type LinterSeverity = z.infer<typeof linterSeveritySchema>;
export type LinterConfig = z.infer<typeof linterConfigSchema>;
export type ArcTemplate = z.infer<typeof arcTemplateSchema>;
export type UIModule = z.infer<typeof uiModuleSchema>;
export type TemplateOverrides = z.infer<typeof templateOverridesSchema>;

export type WriterConfig = z.infer<typeof writerConfigSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export type WriterProject = z.infer<typeof writerProjectSchema>;
export type ProductProject = z.infer<typeof productProjectSchema>;
export type EngineeringProject = z.infer<typeof engineeringProjectSchema>;
export type DesignProject = z.infer<typeof designProjectSchema>;
export type CommsProject = z.infer<typeof commsProjectSchema>;
export type CustomProject = z.infer<typeof customProjectSchema>;

/** Strict project type (discriminated union) */
export type Project = z.infer<typeof projectSchema>;

/** Loose project type for partial/input states */
export type LooseProject = z.infer<typeof looseProjectSchema>;

/** Input type for creating projects (before defaults applied) */
export type ProjectInput = z.input<typeof looseProjectSchema>;

export type WriterDocumentType = z.infer<typeof writerDocumentTypeSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type Document = z.infer<typeof documentSchema>;
