import { z } from "zod";

// Genre types
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

// Style modes (affects linter behavior)
export const styleModeSchema = z.enum([
  "hemingway", // Flag adverbs, prefer short sentences
  "tolkien", // Encourage description, allow longer prose
  "manga", // Flag long dialogue, encourage action beats
  "noir", // Encourage metaphor, moody atmosphere
  "minimalist", // Flag excessive description
  "purple_prose", // Allow flowery language
]);

// Linter severity levels
export const linterSeveritySchema = z.enum([
  "off",
  "info",
  "warning",
  "error",
  "critical",
]);

// Linter configuration
export const linterConfigSchema = z.object({
  // Consistency checks
  nameConsistency: linterSeveritySchema.default("error"),
  visualConsistency: linterSeveritySchema.default("warning"),
  locationConsistency: linterSeveritySchema.default("warning"),
  timelineConsistency: linterSeveritySchema.default("info"),

  // Archetype checks
  archetypeDeviation: linterSeveritySchema.default("warning"),

  // Power scaling (important for LitRPG/Progression)
  powerScaling: linterSeveritySchema.default("info"),

  // Pacing
  pacingFlat: linterSeveritySchema.default("info"),
  dialogueLength: linterSeveritySchema.default("off"),

  // Style
  adverbUsage: linterSeveritySchema.default("off"),
  passiveVoice: linterSeveritySchema.default("off"),
  showDontTell: linterSeveritySchema.default("off"),

  // Symbolism (for literary/psychological fiction)
  symbolismConsistency: linterSeveritySchema.default("off"),
});

// Arc structure templates
export const arcTemplateSchema = z.enum([
  "heros_journey", // Campbell's monomyth
  "three_act", // Setup, Confrontation, Resolution
  "five_act", // Exposition, Rising Action, Climax, Falling Action, Denouement
  "kishotenketsu", // Japanese 4-act (Introduction, Development, Twist, Conclusion)
  "tragic_fall", // Faustian/Tragedy structure
  "save_the_cat", // Blake Snyder's beats
  "dan_harmon_circle", // Story circle
  "freeform", // No structure
]);

// Template IDs for builtin templates
export const templateIdSchema = z.enum([
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

// UI Module configuration
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
  "world_graph",
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

// Project configuration
export const projectConfigSchema = z.object({
  genre: genreSchema.optional(),
  subGenres: z.array(genreSchema).optional(),
  styleMode: styleModeSchema.default("manga"),
  arcTemplate: arcTemplateSchema.default("three_act"),
  linterConfig: linterConfigSchema.default({}),

  // Custom rules
  customRules: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        pattern: z.string().optional(), // Regex pattern
        severity: linterSeveritySchema,
      })
    )
    .optional(),

  // Word count targets
  targets: z
    .object({
      chapterWordCount: z.number().optional(),
      totalWordCount: z.number().optional(),
    })
    .optional(),
});

// Template override configuration (for customizing a template per-project)
export const templateOverridesSchema = z.object({
  // Entity kinds to add (custom kinds)
  customEntityKinds: z.array(z.any()).optional(),
  // Entity kinds from template to disable
  disabledEntityKinds: z.array(z.string()).optional(),
  // Relationship kinds to add
  customRelationshipKinds: z.array(z.any()).optional(),
  // Document kinds to add
  customDocumentKinds: z.array(z.any()).optional(),
  // UI module overrides (enable/disable specific modules)
  uiModuleOverrides: z.record(uiModuleSchema, z.boolean()).optional(),
});

// Project schema
export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  // Template configuration
  templateId: templateIdSchema.optional(),
  templateOverrides: templateOverridesSchema.optional(),
  // Legacy config (merged with template defaults)
  config: projectConfigSchema.default({}),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Document types
export const documentTypeSchema = z.enum([
  "chapter",
  "scene",
  "note",
  "outline",
  "worldbuilding",
]);

// Document schema
export const documentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentId: z.string().optional(),
  type: documentTypeSchema,
  title: z.string().optional(),
  content: z.any(), // Tiptap JSON content
  orderIndex: z.number().int().default(0),
  wordCount: z.number().int().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Genre = z.infer<typeof genreSchema>;
export type StyleMode = z.infer<typeof styleModeSchema>;
export type LinterSeverity = z.infer<typeof linterSeveritySchema>;
export type LinterConfig = z.infer<typeof linterConfigSchema>;
export type ArcTemplate = z.infer<typeof arcTemplateSchema>;
export type TemplateId = z.infer<typeof templateIdSchema>;
export type UIModule = z.infer<typeof uiModuleSchema>;
export type TemplateOverrides = z.infer<typeof templateOverridesSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type Project = z.infer<typeof projectSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type Document = z.infer<typeof documentSchema>;
