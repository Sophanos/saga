/**
 * Template Registry Types
 *
 * The template system enables Mythos IDE to support any creative genre:
 * - Epic Fantasy (LOTR, Wheel of Time)
 * - Wizarding Worlds (Harry Potter)
 * - Manga/Anime (Shounen, Seinen, Shoujo, Isekai)
 * - TTRPG Campaigns (D&D, Pathfinder, Call of Cthulhu)
 * - Literary Fiction (Faust, Crime & Punishment)
 * - Science Fiction (Dune, Foundation)
 * - Visual Novels / Interactive Fiction
 * - Webnovels / Serial Fiction
 * - Screenwriting
 * - Comics / Graphic Novels
 */

import type { JungianArchetype } from "../entities/types";
import type { Genre, StyleMode, ArcTemplate } from "../schema/project.schema";

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

/** Field input types for entity property editors */
export type FieldKind =
  | "string" // Single line text
  | "text" // Multi-line text / rich text
  | "number" // Numeric value
  | "boolean" // Toggle / checkbox
  | "enum" // Single select from options
  | "multi_enum" // Multi-select from options
  | "entity_ref" // Reference to another entity
  | "entity_ref_list" // List of entity references
  | "date" // Date value (for timelines)
  | "color" // Color picker
  | "image" // Image URL or upload
  | "stat_block" // D&D-style stat block
  | "power_level" // Numeric power scaling (LitRPG)
  | "tags"; // Tag list

/** Definition of a custom field on an entity kind */
export interface FieldDefinition {
  id: string;
  label: string;
  kind: FieldKind;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  /** For enum/multi_enum: the available options */
  options?: { value: string; label: string; color?: string }[];
  /** For entity_ref/entity_ref_list: which entity kinds can be referenced */
  refEntityKinds?: string[];
  /** For number/power_level: min/max constraints */
  min?: number;
  max?: number;
  /** For stat_block: the stat keys */
  statKeys?: string[];
  /** Group for organizing fields in UI */
  group?: string;
  /** Mode visibility: show only in writer/dm mode, or both */
  visibleIn?: "writer" | "dm" | "both";
}

// ============================================================================
// ENTITY KIND DEFINITIONS
// ============================================================================

/** Semantic category for entity kinds */
export type EntityCategory =
  | "agent" // Characters, NPCs, creatures
  | "place" // Locations, realms, dimensions
  | "object" // Items, artifacts, vehicles
  | "system" // Magic systems, tech systems, rules
  | "organization" // Factions, guilds, nations
  | "temporal" // Events, eras, timelines
  | "abstract" // Concepts, themes, prophecies
  | "narrative" // Arcs, quests, subplots
  | "mechanical"; // Stats, abilities, game mechanics

/** Definition of an entity kind (type) */
export interface EntityKindDefinition {
  /** Unique identifier (e.g., "character", "monster", "spell") */
  kind: string;
  /** Display label */
  label: string;
  /** Plural label */
  labelPlural: string;
  /** Semantic category */
  category: EntityCategory;
  /** CSS color (hex or CSS variable) */
  color: string;
  /** Icon identifier (Lucide icon name) */
  icon: string;
  /** Description for UI tooltips */
  description?: string;
  /** Custom fields specific to this entity kind */
  fields: FieldDefinition[];
  /** Default archetype suggestions (for character-like entities) */
  archetypes?: JungianArchetype[];
  /** Whether this kind has visual description (enables Mangaka panel) */
  hasVisualDescription?: boolean;
  /** Whether this kind has status tracking (enables HUD status) */
  hasStatus?: boolean;
  /** Mode visibility */
  visibleIn?: "writer" | "dm" | "both";
}

// ============================================================================
// RELATIONSHIP KIND DEFINITIONS
// ============================================================================

/** Definition of a relationship kind */
export interface RelationshipKindDefinition {
  /** Unique identifier */
  kind: string;
  /** Display label (e.g., "Parent of") */
  label: string;
  /** Inverse label for bidirectional (e.g., "Child of") */
  inverseLabel?: string;
  /** Semantic category */
  category:
    | "familial"
    | "social"
    | "romantic"
    | "professional"
    | "spatial"
    | "ownership"
    | "conflict"
    | "magical"
    | "mechanical"
    | "narrative";
  /** CSS color */
  color: string;
  /** Whether relationship is inherently bidirectional */
  defaultBidirectional?: boolean;
  /** Which entity kinds can be the source */
  validSourceKinds?: string[];
  /** Which entity kinds can be the target */
  validTargetKinds?: string[];
  /** Mode visibility */
  visibleIn?: "writer" | "dm" | "both";
}

// ============================================================================
// DOCUMENT KIND DEFINITIONS
// ============================================================================

/** Definition of a document kind */
export interface DocumentKindDefinition {
  /** Unique identifier */
  kind: string;
  /** Display label */
  label: string;
  /** Plural label */
  labelPlural: string;
  /** Icon */
  icon: string;
  /** Description */
  description?: string;
  /** Whether documents of this kind can have children */
  allowChildren?: boolean;
  /** Allowed child document kinds */
  childKinds?: string[];
  /** Default content template (Tiptap JSON) */
  defaultContent?: unknown;
  /** Mode visibility */
  visibleIn?: "writer" | "dm" | "both";
}

// ============================================================================
// UI MODULE DEFINITIONS
// ============================================================================

/** UI modules that can be enabled/disabled per template */
export type UIModuleId =
  // Core panels
  | "manifest" // Entity list sidebar
  | "console" // Bottom panel with tabs
  | "hud" // Entity HUD overlay
  // Console tabs
  | "chat" // AI chat
  | "linter" // Consistency linter
  | "dynamics" // Event/interaction stream
  | "coach" // Writing coach
  | "history" // Analysis history
  // Canvas views
  | "editor" // Main text editor
  | "world_graph" // Relationship graph view
  | "map" // Spatial map view
  | "timeline" // Timeline view
  | "codex" // Encyclopedia view
  | "storyboard" // Manga storyboard view
  // DM-specific
  | "encounter" // Encounter builder
  | "initiative" // Initiative tracker
  | "stat_blocks" // Stat block manager
  | "loot" // Loot generator
  | "session_notes" // Session notes
  // Writer-specific
  | "outline" // Outline view
  | "character_arcs" // Arc tracker
  | "scene_beats"; // Beat sheet

/** UI module configuration */
export interface UIModuleConfig {
  module: UIModuleId;
  enabled: boolean;
  /** Default position/order */
  order?: number;
  /** Custom label override */
  label?: string;
}

// ============================================================================
// LINTER RULE DEFINITIONS
// ============================================================================

/** Custom linter rule for genre-specific validation */
export interface LinterRuleDefinition {
  id: string;
  label: string;
  description: string;
  /** Default severity */
  defaultSeverity: "off" | "info" | "warning" | "error" | "critical";
  /** Which genres this rule applies to */
  applicableGenres?: Genre[];
  /** Rule category */
  category:
    | "consistency"
    | "style"
    | "pacing"
    | "power_scaling"
    | "continuity"
    | "genre_convention"
    | "mechanical";
}

// ============================================================================
// PROJECT TEMPLATE
// ============================================================================

/** Complete project template definition */
export interface ProjectTemplate {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Icon */
  icon: string;
  /** Preview image URL */
  previewImage?: string;
  /** Template category for organization */
  category: TemplateCategory;
  /** Tags for search/filter */
  tags: string[];

  // Genre & Style defaults
  defaultGenre: Genre;
  suggestedGenres: Genre[];
  defaultStyleMode: StyleMode;
  defaultArcTemplate: ArcTemplate;

  // Entity configuration
  entityKinds: EntityKindDefinition[];
  /** Which entity kinds are shown by default in new projects */
  defaultEntityKinds: string[];

  // Relationship configuration
  relationshipKinds: RelationshipKindDefinition[];

  // Document configuration
  documentKinds: DocumentKindDefinition[];
  defaultDocumentKind: string;

  // UI configuration
  uiModules: UIModuleConfig[];
  /** Default mode (writer or dm) */
  defaultMode: "writer" | "dm";
  /** Whether DM mode is available */
  dmModeEnabled: boolean;

  // Linter configuration
  linterRules: LinterRuleDefinition[];

  // Starter content (optional)
  starterEntities?: Array<{
    kind: string;
    name: string;
    properties?: Record<string, unknown>;
  }>;
  starterDocuments?: Array<{
    kind: string;
    title: string;
    content?: unknown;
  }>;
}

/** Template category for grouping in UI */
export type TemplateCategory =
  | "fantasy" // Epic Fantasy, Urban Fantasy, etc.
  | "scifi" // Science Fiction, Space Opera
  | "horror" // Horror, Gothic, Lovecraftian
  | "literary" // Literary Fiction, Classics
  | "ttrpg" // D&D, Pathfinder, etc.
  | "manga" // Manga, Anime, Light Novel
  | "visual" // Comics, Graphic Novels, Visual Novels
  | "screenplay" // Film, TV, Stage
  | "serial" // Webnovels, Serial Fiction
  | "custom"; // User-created

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/** Runtime template registry */
export interface TemplateRegistry {
  /** All available templates */
  templates: Map<string, ProjectTemplate>;
  /** Get template by ID */
  getTemplate(id: string): ProjectTemplate | undefined;
  /** Get templates by category */
  getByCategory(category: TemplateCategory): ProjectTemplate[];
  /** Search templates */
  search(query: string): ProjectTemplate[];
  /** Register a custom template */
  register(template: ProjectTemplate): void;
}

// ============================================================================
// PROJECT TEMPLATE OVERRIDES
// ============================================================================

/** Per-project customizations on top of a template */
export interface ProjectTemplateOverrides {
  /** Base template ID */
  templateId: string;
  /** Additional entity kinds */
  customEntityKinds?: EntityKindDefinition[];
  /** Disabled entity kinds from base template */
  disabledEntityKinds?: string[];
  /** Additional relationship kinds */
  customRelationshipKinds?: RelationshipKindDefinition[];
  /** Additional document kinds */
  customDocumentKinds?: DocumentKindDefinition[];
  /** UI module overrides */
  uiModuleOverrides?: Partial<Record<UIModuleId, boolean>>;
  /** Custom linter rules */
  customLinterRules?: LinterRuleDefinition[];
}
