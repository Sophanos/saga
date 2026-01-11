/**
 * Builtin Project Templates
 *
 * Comprehensive templates for every creative writing genre.
 * Each template configures entity kinds, relationships, documents,
 * and UI modules optimized for that genre's conventions.
 */

import type {
  ProjectTemplate,
  EntityKindDefinition,
  RelationshipKindDefinition,
  DocumentKindDefinition,
  UIModuleConfig,
  LinterRuleDefinition,
} from "./types";

// ============================================================================
// SHARED ENTITY KINDS (used across multiple templates)
// ============================================================================

const CHARACTER_BASE: EntityKindDefinition = {
  kind: "character",
  label: "Character",
  labelPlural: "Characters",
  category: "agent",
  color: "#60a5fa",
  icon: "User",
  description: "A person, being, or sentient creature in your story",
  hasVisualDescription: true,
  hasStatus: true,
  fields: [
    {
      id: "role",
      label: "Role",
      kind: "enum",
      options: [
        { value: "protagonist", label: "Protagonist", color: "#22c55e" },
        { value: "antagonist", label: "Antagonist", color: "#ef4444" },
        { value: "deuteragonist", label: "Deuteragonist", color: "#3b82f6" },
        { value: "supporting", label: "Supporting", color: "#a855f7" },
        { value: "minor", label: "Minor", color: "#6b7280" },
      ],
    },
    { id: "age", label: "Age", kind: "string" },
    { id: "occupation", label: "Occupation", kind: "string" },
    { id: "backstory", label: "Backstory", kind: "text", group: "background" },
    { id: "goals", label: "Goals", kind: "tags", group: "motivation" },
    { id: "fears", label: "Fears", kind: "tags", group: "motivation" },
    { id: "secrets", label: "Secrets", kind: "text", group: "hidden", visibleIn: "dm" },
    { id: "voiceNotes", label: "Voice Notes", kind: "text", group: "writing" },
  ],
  archetypes: [
    "hero",
    "mentor",
    "shadow",
    "trickster",
    "herald",
    "shapeshifter",
    "threshold_guardian",
    "ally",
  ],
};

const LOCATION_BASE: EntityKindDefinition = {
  kind: "location",
  label: "Location",
  labelPlural: "Locations",
  category: "place",
  color: "#22c55e",
  icon: "MapPin",
  description: "A place in your story world",
  fields: [
    { id: "locationType", label: "Type", kind: "string" },
    { id: "climate", label: "Climate", kind: "string" },
    { id: "atmosphere", label: "Atmosphere", kind: "text" },
    { id: "history", label: "History", kind: "text", group: "background" },
    { id: "secrets", label: "Hidden Secrets", kind: "text", visibleIn: "dm" },
  ],
};

const ITEM_BASE: EntityKindDefinition = {
  kind: "item",
  label: "Item",
  labelPlural: "Items",
  category: "object",
  color: "#f59e0b",
  icon: "Gem",
  description: "An object of significance",
  fields: [
    {
      id: "category",
      label: "Category",
      kind: "enum",
      options: [
        { value: "weapon", label: "Weapon" },
        { value: "armor", label: "Armor" },
        { value: "artifact", label: "Artifact" },
        { value: "consumable", label: "Consumable" },
        { value: "key", label: "Key Item" },
        { value: "other", label: "Other" },
      ],
    },
    {
      id: "rarity",
      label: "Rarity",
      kind: "enum",
      options: [
        { value: "common", label: "Common", color: "#9ca3af" },
        { value: "uncommon", label: "Uncommon", color: "#22c55e" },
        { value: "rare", label: "Rare", color: "#3b82f6" },
        { value: "legendary", label: "Legendary", color: "#a855f7" },
        { value: "unique", label: "Unique", color: "#f59e0b" },
      ],
    },
    { id: "abilities", label: "Abilities", kind: "tags" },
    { id: "history", label: "History", kind: "text" },
  ],
};

const FACTION_BASE: EntityKindDefinition = {
  kind: "faction",
  label: "Faction",
  labelPlural: "Factions",
  category: "organization",
  color: "#a855f7",
  icon: "Users",
  description: "An organization, group, or political entity",
  fields: [
    { id: "type", label: "Type", kind: "string" },
    { id: "headquarters", label: "Headquarters", kind: "entity_ref", refEntityKinds: ["location"] },
    { id: "goals", label: "Goals", kind: "tags" },
    { id: "values", label: "Values", kind: "tags" },
    { id: "secrets", label: "Secrets", kind: "text", visibleIn: "dm" },
  ],
};

const EVENT_BASE: EntityKindDefinition = {
  kind: "event",
  label: "Event",
  labelPlural: "Events",
  category: "temporal",
  color: "#ec4899",
  icon: "Calendar",
  description: "A significant event in the story timeline",
  fields: [
    { id: "date", label: "Date/Era", kind: "string" },
    { id: "duration", label: "Duration", kind: "string" },
    { id: "participants", label: "Participants", kind: "entity_ref_list", refEntityKinds: ["character", "faction"] },
    { id: "location", label: "Location", kind: "entity_ref", refEntityKinds: ["location"] },
    { id: "consequences", label: "Consequences", kind: "text" },
  ],
};

const CONCEPT_BASE: EntityKindDefinition = {
  kind: "concept",
  label: "Concept",
  labelPlural: "Concepts",
  category: "abstract",
  color: "#06b6d4",
  icon: "Lightbulb",
  description: "An abstract concept, theme, or motif",
  fields: [
    { id: "category", label: "Category", kind: "string" },
    { id: "symbolism", label: "Symbolism", kind: "text" },
    { id: "manifestations", label: "Manifestations", kind: "tags" },
  ],
};

// ============================================================================
// SHARED RELATIONSHIP KINDS
// ============================================================================

const FAMILIAL_RELATIONSHIPS: RelationshipKindDefinition[] = [
  { kind: "parent_of", label: "Parent of", inverseLabel: "Child of", category: "familial", color: "#60a5fa" },
  { kind: "sibling_of", label: "Sibling of", category: "familial", color: "#60a5fa", defaultBidirectional: true },
  { kind: "married_to", label: "Married to", category: "romantic", color: "#ec4899", defaultBidirectional: true },
  { kind: "ancestor_of", label: "Ancestor of", inverseLabel: "Descendant of", category: "familial", color: "#60a5fa" },
];

const SOCIAL_RELATIONSHIPS: RelationshipKindDefinition[] = [
  { kind: "knows", label: "Knows", category: "social", color: "#6b7280", defaultBidirectional: true },
  { kind: "friend_of", label: "Friend of", category: "social", color: "#22c55e", defaultBidirectional: true },
  { kind: "loves", label: "Loves", category: "romantic", color: "#ec4899" },
  { kind: "hates", label: "Hates", category: "conflict", color: "#ef4444" },
  { kind: "respects", label: "Respects", category: "social", color: "#3b82f6" },
  { kind: "fears", label: "Fears", category: "social", color: "#a855f7" },
  { kind: "mentors", label: "Mentors", inverseLabel: "Mentored by", category: "professional", color: "#f59e0b" },
  { kind: "rivals", label: "Rivals", category: "conflict", color: "#ef4444", defaultBidirectional: true },
];

const ORGANIZATIONAL_RELATIONSHIPS: RelationshipKindDefinition[] = [
  { kind: "member_of", label: "Member of", category: "professional", color: "#a855f7", validTargetKinds: ["faction"] },
  { kind: "leads", label: "Leads", inverseLabel: "Led by", category: "professional", color: "#f59e0b" },
  { kind: "serves", label: "Serves", inverseLabel: "Served by", category: "professional", color: "#6b7280" },
  { kind: "allied_with", label: "Allied with", category: "professional", color: "#22c55e", defaultBidirectional: true },
  { kind: "enemy_of", label: "Enemy of", category: "conflict", color: "#ef4444", defaultBidirectional: true },
];

const SPATIAL_RELATIONSHIPS: RelationshipKindDefinition[] = [
  { kind: "located_in", label: "Located in", category: "spatial", color: "#22c55e" },
  { kind: "connected_to", label: "Connected to", category: "spatial", color: "#22c55e", defaultBidirectional: true },
  { kind: "borders", label: "Borders", category: "spatial", color: "#22c55e", defaultBidirectional: true },
];

const OWNERSHIP_RELATIONSHIPS: RelationshipKindDefinition[] = [
  { kind: "owns", label: "Owns", inverseLabel: "Owned by", category: "ownership", color: "#f59e0b" },
  { kind: "created", label: "Created", inverseLabel: "Created by", category: "ownership", color: "#f59e0b" },
  { kind: "guards", label: "Guards", category: "ownership", color: "#f59e0b" },
  { kind: "wields", label: "Wields", category: "ownership", color: "#f59e0b", validTargetKinds: ["item"] },
];

// ============================================================================
// SHARED DOCUMENT KINDS
// ============================================================================

const PROSE_DOCUMENTS: DocumentKindDefinition[] = [
  {
    kind: "chapter",
    label: "Chapter",
    labelPlural: "Chapters",
    icon: "BookOpen",
    description: "A chapter in your manuscript",
    allowChildren: true,
    childKinds: ["scene"],
  },
  {
    kind: "scene",
    label: "Scene",
    labelPlural: "Scenes",
    icon: "Film",
    description: "A scene within a chapter",
    allowChildren: false,
  },
  {
    kind: "outline",
    label: "Outline",
    labelPlural: "Outlines",
    icon: "List",
    description: "Story outline or beat sheet",
    allowChildren: true,
  },
  {
    kind: "note",
    label: "Note",
    labelPlural: "Notes",
    icon: "StickyNote",
    description: "Freeform notes",
    allowChildren: false,
  },
  {
    kind: "worldbuilding",
    label: "Worldbuilding",
    labelPlural: "Worldbuilding",
    icon: "Globe",
    description: "World documentation",
    allowChildren: true,
  },
];

// ============================================================================
// SHARED UI CONFIGURATIONS
// ============================================================================

const WRITER_UI_MODULES: UIModuleConfig[] = [
  { module: "manifest", enabled: true, order: 1 },
  { module: "console", enabled: true, order: 2 },
  { module: "hud", enabled: true, order: 3 },
  { module: "chat", enabled: true, order: 4 },
  { module: "linter", enabled: true, order: 5 },
  { module: "dynamics", enabled: true, order: 6 },
  { module: "coach", enabled: true, order: 7 },
  { module: "history", enabled: true, order: 8 },
  { module: "editor", enabled: true, order: 9 },
  { module: "project_graph", enabled: true, order: 10 },
  { module: "timeline", enabled: true, order: 11 },
  { module: "codex", enabled: true, order: 12 },
  { module: "outline", enabled: true, order: 13 },
  { module: "character_arcs", enabled: true, order: 14 },
];

const DM_UI_MODULES: UIModuleConfig[] = [
  ...WRITER_UI_MODULES,
  { module: "encounter", enabled: true, order: 20 },
  { module: "initiative", enabled: true, order: 21 },
  { module: "stat_blocks", enabled: true, order: 22 },
  { module: "loot", enabled: true, order: 23 },
  { module: "session_notes", enabled: true, order: 24 },
];

// ============================================================================
// SHARED LINTER RULES
// ============================================================================

const BASE_LINTER_RULES: LinterRuleDefinition[] = [
  {
    id: "name_consistency",
    label: "Name Consistency",
    description: "Detect character name misspellings or inconsistent usage",
    defaultSeverity: "error",
    category: "consistency",
  },
  {
    id: "visual_consistency",
    label: "Visual Consistency",
    description: "Detect contradictions in character appearance descriptions",
    defaultSeverity: "warning",
    category: "consistency",
  },
  {
    id: "timeline_consistency",
    label: "Timeline Consistency",
    description: "Detect chronological contradictions",
    defaultSeverity: "warning",
    category: "continuity",
  },
  {
    id: "location_consistency",
    label: "Location Consistency",
    description: "Detect impossible character movements or location contradictions",
    defaultSeverity: "warning",
    category: "consistency",
  },
];

// ============================================================================
// EPIC FANTASY TEMPLATE (LOTR / Wheel of Time / Malazan)
// ============================================================================

const MAGIC_SYSTEM: EntityKindDefinition = {
  kind: "magic_system",
  label: "Magic System",
  labelPlural: "Magic Systems",
  category: "system",
  color: "#8b5cf6",
  icon: "Sparkles",
  description: "A system of magic or supernatural power",
  fields: [
    { id: "source", label: "Source", kind: "string" },
    { id: "rules", label: "Rules", kind: "tags" },
    { id: "limitations", label: "Limitations", kind: "tags" },
    { id: "costs", label: "Costs", kind: "tags" },
    { id: "manifestations", label: "Manifestations", kind: "text" },
  ],
};

const PROPHECY: EntityKindDefinition = {
  kind: "prophecy",
  label: "Prophecy",
  labelPlural: "Prophecies",
  category: "abstract",
  color: "#c084fc",
  icon: "Eye",
  description: "A prophecy, foretelling, or fate",
  fields: [
    { id: "text", label: "Prophecy Text", kind: "text" },
    { id: "origin", label: "Origin", kind: "string" },
    { id: "subjects", label: "Subjects", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "fulfilled", label: "Fulfilled", kind: "boolean" },
    { id: "interpretation", label: "Interpretation", kind: "text", visibleIn: "dm" },
  ],
};

const LANGUAGE: EntityKindDefinition = {
  kind: "language",
  label: "Language",
  labelPlural: "Languages",
  category: "abstract",
  color: "#14b8a6",
  icon: "Languages",
  description: "A language spoken in your world",
  fields: [
    { id: "family", label: "Language Family", kind: "string" },
    { id: "speakers", label: "Speakers", kind: "entity_ref_list", refEntityKinds: ["faction", "character"] },
    { id: "script", label: "Script", kind: "string" },
    { id: "samples", label: "Sample Phrases", kind: "text" },
  ],
};

const CULTURE: EntityKindDefinition = {
  kind: "culture",
  label: "Culture",
  labelPlural: "Cultures",
  category: "organization",
  color: "#f472b6",
  icon: "Landmark",
  description: "A cultural group or civilization",
  fields: [
    { id: "values", label: "Values", kind: "tags" },
    { id: "customs", label: "Customs", kind: "text" },
    { id: "religion", label: "Religion", kind: "text" },
    { id: "language", label: "Language", kind: "entity_ref", refEntityKinds: ["language"] },
    { id: "homeland", label: "Homeland", kind: "entity_ref", refEntityKinds: ["location"] },
  ],
};

const ARTIFACT: EntityKindDefinition = {
  kind: "artifact",
  label: "Artifact",
  labelPlural: "Artifacts",
  category: "object",
  color: "#fbbf24",
  icon: "Crown",
  description: "A powerful or legendary artifact",
  fields: [
    { id: "origin", label: "Origin", kind: "text" },
    { id: "powers", label: "Powers", kind: "tags" },
    { id: "curse", label: "Curse/Drawback", kind: "text" },
    { id: "currentLocation", label: "Current Location", kind: "entity_ref", refEntityKinds: ["location", "character"] },
    { id: "history", label: "History", kind: "text" },
  ],
};

const DEITY: EntityKindDefinition = {
  kind: "deity",
  label: "Deity",
  labelPlural: "Deities",
  category: "agent",
  color: "#facc15",
  icon: "Sun",
  description: "A god, goddess, or divine being",
  hasStatus: true,
  fields: [
    { id: "domain", label: "Domain", kind: "tags" },
    { id: "symbols", label: "Symbols", kind: "tags" },
    { id: "worshippers", label: "Worshippers", kind: "entity_ref_list", refEntityKinds: ["faction", "culture"] },
    { id: "rivals", label: "Rival Deities", kind: "entity_ref_list", refEntityKinds: ["deity"] },
    { id: "tenets", label: "Tenets", kind: "text" },
  ],
};

export const EPIC_FANTASY_TEMPLATE: ProjectTemplate = {
  id: "epic_fantasy",
  name: "Epic Fantasy",
  description:
    "For sprawling fantasy epics with rich worldbuilding, complex magic systems, and multi-generational stories. Inspired by Tolkien, Jordan, Sanderson, and Erikson.",
  icon: "Sword",
  category: "fantasy",
  tags: ["lotr", "wheel of time", "malazan", "stormlight", "magic", "worldbuilding"],
  defaultGenre: "high_fantasy",
  suggestedGenres: ["high_fantasy", "grimdark", "progression_fantasy"],
  defaultStyleMode: "tolkien",
  defaultArcTemplate: "heros_journey",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    ITEM_BASE,
    FACTION_BASE,
    EVENT_BASE,
    CONCEPT_BASE,
    MAGIC_SYSTEM,
    PROPHECY,
    LANGUAGE,
    CULTURE,
    ARTIFACT,
    DEITY,
  ],
  defaultEntityKinds: ["character", "location", "faction", "magic_system"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    ...SPATIAL_RELATIONSHIPS,
    ...OWNERSHIP_RELATIONSHIPS,
    { kind: "worships", label: "Worships", category: "magical", color: "#facc15", validTargetKinds: ["deity"] },
    { kind: "speaks", label: "Speaks", category: "social", color: "#14b8a6", validTargetKinds: ["language"] },
    { kind: "fulfills", label: "Fulfills", category: "magical", color: "#c084fc", validTargetKinds: ["prophecy"] },
    { kind: "uses_magic", label: "Uses Magic", category: "magical", color: "#8b5cf6", validTargetKinds: ["magic_system"] },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: true,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "magic_consistency",
      label: "Magic Consistency",
      description: "Detect violations of established magic system rules",
      defaultSeverity: "error",
      category: "consistency",
    },
    {
      id: "prophecy_tracking",
      label: "Prophecy Tracking",
      description: "Track prophecy fulfillment and foreshadowing",
      defaultSeverity: "info",
      category: "continuity",
    },
  ],
};

// ============================================================================
// WIZARDING WORLD TEMPLATE (Harry Potter style)
// ============================================================================

const SPELL: EntityKindDefinition = {
  kind: "spell",
  label: "Spell",
  labelPlural: "Spells",
  category: "mechanical",
  color: "#a855f7",
  icon: "Wand2",
  description: "A magical spell or incantation",
  fields: [
    { id: "incantation", label: "Incantation", kind: "string" },
    { id: "effect", label: "Effect", kind: "text" },
    { id: "difficulty", label: "Difficulty", kind: "enum", options: [
      { value: "basic", label: "Basic" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
      { value: "master", label: "Master Level" },
      { value: "forbidden", label: "Forbidden", color: "#ef4444" },
    ]},
    { id: "wandMovement", label: "Wand Movement", kind: "string" },
    { id: "counters", label: "Counter-spells", kind: "entity_ref_list", refEntityKinds: ["spell"] },
  ],
};

const MAGICAL_CREATURE: EntityKindDefinition = {
  kind: "magical_creature",
  label: "Magical Creature",
  labelPlural: "Magical Creatures",
  category: "agent",
  color: "#22d3ee",
  icon: "Bug",
  description: "A magical beast or creature",
  hasVisualDescription: true,
  fields: [
    { id: "classification", label: "Classification", kind: "string" },
    { id: "dangerRating", label: "Danger Rating", kind: "string" },
    { id: "habitat", label: "Habitat", kind: "entity_ref_list", refEntityKinds: ["location"] },
    { id: "abilities", label: "Abilities", kind: "tags" },
    { id: "weaknesses", label: "Weaknesses", kind: "tags" },
  ],
};

const POTION: EntityKindDefinition = {
  kind: "potion",
  label: "Potion",
  labelPlural: "Potions",
  category: "object",
  color: "#84cc16",
  icon: "FlaskConical",
  description: "A magical potion or elixir",
  fields: [
    { id: "ingredients", label: "Ingredients", kind: "tags" },
    { id: "effect", label: "Effect", kind: "text" },
    { id: "brewTime", label: "Brewing Time", kind: "string" },
    { id: "difficulty", label: "Difficulty", kind: "string" },
    { id: "sideEffects", label: "Side Effects", kind: "text" },
  ],
};

export const WIZARDING_WORLD_TEMPLATE: ProjectTemplate = {
  id: "wizarding_world",
  name: "Wizarding World",
  description:
    "For magical school stories, hidden magical societies, and whimsical fantasy. Inspired by Harry Potter, The Magicians, and similar works.",
  icon: "Wand2",
  category: "fantasy",
  tags: ["harry potter", "magic school", "urban fantasy", "young adult", "wizards"],
  defaultGenre: "urban_fantasy",
  suggestedGenres: ["urban_fantasy", "high_fantasy"],
  defaultStyleMode: "tolkien",
  defaultArcTemplate: "heros_journey",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    ITEM_BASE,
    FACTION_BASE,
    EVENT_BASE,
    SPELL,
    MAGICAL_CREATURE,
    POTION,
    PROPHECY,
  ],
  defaultEntityKinds: ["character", "location", "spell", "faction"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    ...SPATIAL_RELATIONSHIPS,
    ...OWNERSHIP_RELATIONSHIPS,
    { kind: "teaches", label: "Teaches", inverseLabel: "Taught by", category: "professional", color: "#3b82f6" },
    { kind: "house_member", label: "House Member", category: "professional", color: "#a855f7", validTargetKinds: ["faction"] },
    { kind: "blood_status", label: "Blood Status", category: "social", color: "#6b7280" },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: false,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "spell_consistency",
      label: "Spell Consistency",
      description: "Track spell usage and limitations",
      defaultSeverity: "warning",
      category: "consistency",
    },
  ],
};

// ============================================================================
// D&D CAMPAIGN TEMPLATE
// ============================================================================

const PC: EntityKindDefinition = {
  kind: "pc",
  label: "Player Character",
  labelPlural: "Player Characters",
  category: "agent",
  color: "#22c55e",
  icon: "UserCheck",
  description: "A player character",
  hasVisualDescription: true,
  hasStatus: true,
  fields: [
    { id: "player", label: "Player Name", kind: "string" },
    { id: "class", label: "Class", kind: "string" },
    { id: "level", label: "Level", kind: "number", min: 1, max: 20 },
    { id: "race", label: "Race", kind: "string" },
    { id: "background", label: "Background", kind: "string" },
    {
      id: "stats",
      label: "Ability Scores",
      kind: "stat_block",
      statKeys: ["STR", "DEX", "CON", "INT", "WIS", "CHA"],
    },
    { id: "hp", label: "HP", kind: "number" },
    { id: "ac", label: "AC", kind: "number" },
    { id: "proficiencies", label: "Proficiencies", kind: "tags" },
    { id: "bonds", label: "Bonds", kind: "text" },
    { id: "flaws", label: "Flaws", kind: "text" },
    { id: "ideals", label: "Ideals", kind: "text" },
  ],
};

const NPC: EntityKindDefinition = {
  kind: "npc",
  label: "NPC",
  labelPlural: "NPCs",
  category: "agent",
  color: "#60a5fa",
  icon: "User",
  description: "A non-player character",
  hasVisualDescription: true,
  hasStatus: true,
  fields: [
    { id: "role", label: "Role", kind: "string" },
    { id: "attitude", label: "Attitude", kind: "enum", options: [
      { value: "friendly", label: "Friendly", color: "#22c55e" },
      { value: "neutral", label: "Neutral", color: "#6b7280" },
      { value: "hostile", label: "Hostile", color: "#ef4444" },
    ]},
    { id: "voice", label: "Voice/Mannerisms", kind: "text" },
    { id: "secrets", label: "Secrets", kind: "text", visibleIn: "dm" },
    { id: "statBlock", label: "Stat Block", kind: "text", visibleIn: "dm" },
  ],
};

const MONSTER: EntityKindDefinition = {
  kind: "monster",
  label: "Monster",
  labelPlural: "Monsters",
  category: "agent",
  color: "#ef4444",
  icon: "Skull",
  description: "A monster or enemy creature",
  hasVisualDescription: true,
  hasStatus: true,
  fields: [
    { id: "type", label: "Type", kind: "string" },
    { id: "cr", label: "Challenge Rating", kind: "string" },
    { id: "hp", label: "HP", kind: "number" },
    { id: "ac", label: "AC", kind: "number" },
    {
      id: "stats",
      label: "Ability Scores",
      kind: "stat_block",
      statKeys: ["STR", "DEX", "CON", "INT", "WIS", "CHA"],
    },
    { id: "abilities", label: "Abilities", kind: "tags" },
    { id: "actions", label: "Actions", kind: "text" },
    { id: "legendary", label: "Legendary Actions", kind: "text" },
    { id: "lair", label: "Lair Actions", kind: "text" },
    { id: "tactics", label: "Tactics", kind: "text", visibleIn: "dm" },
  ],
};

const DND_SPELL: EntityKindDefinition = {
  kind: "spell",
  label: "Spell",
  labelPlural: "Spells",
  category: "mechanical",
  color: "#a855f7",
  icon: "Sparkles",
  description: "A D&D spell",
  fields: [
    { id: "level", label: "Level", kind: "number", min: 0, max: 9 },
    { id: "school", label: "School", kind: "enum", options: [
      { value: "abjuration", label: "Abjuration" },
      { value: "conjuration", label: "Conjuration" },
      { value: "divination", label: "Divination" },
      { value: "enchantment", label: "Enchantment" },
      { value: "evocation", label: "Evocation" },
      { value: "illusion", label: "Illusion" },
      { value: "necromancy", label: "Necromancy" },
      { value: "transmutation", label: "Transmutation" },
    ]},
    { id: "castingTime", label: "Casting Time", kind: "string" },
    { id: "range", label: "Range", kind: "string" },
    { id: "components", label: "Components", kind: "string" },
    { id: "duration", label: "Duration", kind: "string" },
    { id: "effect", label: "Effect", kind: "text" },
    { id: "classes", label: "Classes", kind: "tags" },
  ],
};

const QUEST: EntityKindDefinition = {
  kind: "quest",
  label: "Quest",
  labelPlural: "Quests",
  category: "narrative",
  color: "#f59e0b",
  icon: "Scroll",
  description: "A quest or adventure hook",
  fields: [
    { id: "status", label: "Status", kind: "enum", options: [
      { value: "available", label: "Available", color: "#22c55e" },
      { value: "active", label: "Active", color: "#3b82f6" },
      { value: "completed", label: "Completed", color: "#6b7280" },
      { value: "failed", label: "Failed", color: "#ef4444" },
    ]},
    { id: "giver", label: "Quest Giver", kind: "entity_ref", refEntityKinds: ["npc"] },
    { id: "reward", label: "Reward", kind: "text" },
    { id: "objectives", label: "Objectives", kind: "tags" },
    { id: "secretObjectives", label: "Secret Objectives", kind: "text", visibleIn: "dm" },
    { id: "complications", label: "Complications", kind: "text", visibleIn: "dm" },
  ],
};

const ENCOUNTER: EntityKindDefinition = {
  kind: "encounter",
  label: "Encounter",
  labelPlural: "Encounters",
  category: "narrative",
  color: "#ef4444",
  icon: "Swords",
  description: "A combat or social encounter",
  visibleIn: "dm",
  fields: [
    { id: "type", label: "Type", kind: "enum", options: [
      { value: "combat", label: "Combat" },
      { value: "social", label: "Social" },
      { value: "exploration", label: "Exploration" },
      { value: "puzzle", label: "Puzzle" },
    ]},
    { id: "difficulty", label: "Difficulty", kind: "enum", options: [
      { value: "easy", label: "Easy", color: "#22c55e" },
      { value: "medium", label: "Medium", color: "#f59e0b" },
      { value: "hard", label: "Hard", color: "#ef4444" },
      { value: "deadly", label: "Deadly", color: "#7c2d12" },
    ]},
    { id: "location", label: "Location", kind: "entity_ref", refEntityKinds: ["location"] },
    { id: "enemies", label: "Enemies", kind: "entity_ref_list", refEntityKinds: ["monster", "npc"] },
    { id: "tactics", label: "Tactics", kind: "text" },
    { id: "treasure", label: "Treasure", kind: "text" },
    { id: "xpReward", label: "XP Reward", kind: "number" },
  ],
};

const SESSION_DOC: DocumentKindDefinition = {
  kind: "session",
  label: "Session",
  labelPlural: "Sessions",
  icon: "Calendar",
  description: "Session notes and recap",
  allowChildren: false,
  visibleIn: "dm",
};

export const DND_CAMPAIGN_TEMPLATE: ProjectTemplate = {
  id: "dnd_campaign",
  name: "D&D Campaign",
  description:
    "For Dungeon Masters running tabletop RPG campaigns. Track NPCs, encounters, quests, and session notes with full DM mode support.",
  icon: "Dice5",
  category: "ttrpg",
  tags: ["d&d", "dungeons and dragons", "pathfinder", "ttrpg", "tabletop", "dm", "game master"],
  defaultGenre: "high_fantasy",
  suggestedGenres: ["high_fantasy", "grimdark", "horror"],
  defaultStyleMode: "tolkien",
  defaultArcTemplate: "three_act",
  entityKinds: [
    PC,
    NPC,
    MONSTER,
    LOCATION_BASE,
    ITEM_BASE,
    FACTION_BASE,
    DND_SPELL,
    QUEST,
    ENCOUNTER,
    EVENT_BASE,
  ],
  defaultEntityKinds: ["pc", "npc", "location", "quest"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    ...SPATIAL_RELATIONSHIPS,
    ...OWNERSHIP_RELATIONSHIPS,
    { kind: "patron_of", label: "Patron of", inverseLabel: "Warlock of", category: "magical", color: "#a855f7" },
    { kind: "hunts", label: "Hunts", category: "conflict", color: "#ef4444" },
  ],
  documentKinds: [
    ...PROSE_DOCUMENTS,
    SESSION_DOC,
  ],
  defaultDocumentKind: "session",
  uiModules: DM_UI_MODULES,
  defaultMode: "dm",
  dmModeEnabled: true,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "stat_consistency",
      label: "Stat Consistency",
      description: "Track HP, conditions, and status changes",
      defaultSeverity: "warning",
      category: "mechanical",
    },
  ],
};

// ============================================================================
// MANGA / ANIME TEMPLATE
// ============================================================================

const MANGA_CHARACTER: EntityKindDefinition = {
  ...CHARACTER_BASE,
  fields: [
    ...CHARACTER_BASE.fields,
    {
      id: "powerLevel",
      label: "Power Level",
      kind: "power_level",
      min: 1,
      max: 100,
      group: "combat",
    },
    { id: "abilities", label: "Special Abilities", kind: "tags", group: "combat" },
    { id: "transformation", label: "Transformation", kind: "text", group: "combat" },
    { id: "catchphrase", label: "Catchphrase", kind: "string", group: "character" },
    { id: "quirk", label: "Character Quirk", kind: "text", group: "character" },
  ],
};

const TECHNIQUE: EntityKindDefinition = {
  kind: "technique",
  label: "Technique",
  labelPlural: "Techniques",
  category: "mechanical",
  color: "#f97316",
  icon: "Flame",
  description: "A special attack, skill, or technique",
  fields: [
    { id: "user", label: "User", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "type", label: "Type", kind: "string" },
    { id: "power", label: "Power Level", kind: "number", min: 1, max: 10 },
    { id: "requirements", label: "Requirements", kind: "tags" },
    { id: "description", label: "Description", kind: "text" },
    { id: "drawbacks", label: "Drawbacks", kind: "text" },
    { id: "evolution", label: "Evolution/Upgrades", kind: "entity_ref_list", refEntityKinds: ["technique"] },
  ],
};

const ARC: EntityKindDefinition = {
  kind: "arc",
  label: "Story Arc",
  labelPlural: "Story Arcs",
  category: "narrative",
  color: "#ec4899",
  icon: "TrendingUp",
  description: "A major story arc or saga",
  fields: [
    { id: "status", label: "Status", kind: "enum", options: [
      { value: "planned", label: "Planned" },
      { value: "active", label: "Active", color: "#22c55e" },
      { value: "completed", label: "Completed", color: "#6b7280" },
    ]},
    { id: "mainVillain", label: "Main Villain", kind: "entity_ref", refEntityKinds: ["character"] },
    { id: "focusCharacters", label: "Focus Characters", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "themes", label: "Themes", kind: "tags" },
    { id: "climax", label: "Climax", kind: "text" },
    { id: "chapters", label: "Chapters", kind: "string" },
  ],
};

const PANEL: DocumentKindDefinition = {
  kind: "panel",
  label: "Panel",
  labelPlural: "Panels",
  icon: "Square",
  description: "A manga panel or comic frame",
  allowChildren: false,
};

const PAGE: DocumentKindDefinition = {
  kind: "page",
  label: "Page",
  labelPlural: "Pages",
  icon: "FileImage",
  description: "A manga page layout",
  allowChildren: true,
  childKinds: ["panel"],
};

export const MANGA_TEMPLATE: ProjectTemplate = {
  id: "manga_novel",
  name: "Manga / Light Novel",
  description:
    "For manga, anime-style light novels, and shounen/seinen fiction. Track power levels, techniques, story arcs, and visual character designs.",
  icon: "Zap",
  category: "manga",
  tags: ["manga", "anime", "light novel", "shounen", "seinen", "shoujo", "isekai", "power fantasy"],
  defaultGenre: "manga_shounen",
  suggestedGenres: ["manga_shounen", "manga_seinen", "manga_shoujo", "litrpg", "progression_fantasy"],
  defaultStyleMode: "manga",
  defaultArcTemplate: "kishotenketsu",
  entityKinds: [
    MANGA_CHARACTER,
    LOCATION_BASE,
    ITEM_BASE,
    FACTION_BASE,
    TECHNIQUE,
    ARC,
    EVENT_BASE,
    MAGIC_SYSTEM,
  ],
  defaultEntityKinds: ["character", "technique", "arc", "faction"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    { kind: "trained_by", label: "Trained by", inverseLabel: "Trained", category: "professional", color: "#f59e0b" },
    { kind: "defeated_by", label: "Defeated by", inverseLabel: "Defeated", category: "conflict", color: "#ef4444" },
    { kind: "inherited_from", label: "Inherited from", category: "magical", color: "#a855f7" },
    { kind: "uses_technique", label: "Uses Technique", category: "mechanical", color: "#f97316", validTargetKinds: ["technique"] },
  ],
  documentKinds: [
    ...PROSE_DOCUMENTS,
    PAGE,
    PANEL,
    {
      kind: "storyboard",
      label: "Storyboard",
      labelPlural: "Storyboards",
      icon: "LayoutGrid",
      description: "Visual storyboard layout",
      allowChildren: true,
      childKinds: ["page"],
    },
  ],
  defaultDocumentKind: "chapter",
  uiModules: [
    ...WRITER_UI_MODULES,
    { module: "storyboard", enabled: true, order: 15 },
    { module: "scene_beats", enabled: true, order: 16 },
  ],
  defaultMode: "writer",
  dmModeEnabled: false,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "power_scaling",
      label: "Power Scaling",
      description: "Track power levels and prevent inconsistencies",
      defaultSeverity: "warning",
      category: "power_scaling",
      applicableGenres: ["manga_shounen", "manga_seinen", "litrpg", "progression_fantasy"],
    },
    {
      id: "pacing_rhythm",
      label: "Pacing Rhythm",
      description: "Ensure proper pacing for manga-style storytelling",
      defaultSeverity: "info",
      category: "pacing",
    },
    {
      id: "dialogue_density",
      label: "Dialogue Density",
      description: "Flag excessive dialogue that would overcrowd panels",
      defaultSeverity: "warning",
      category: "style",
    },
  ],
};

// ============================================================================
// LITERARY FICTION TEMPLATE (Faust, Dostoevsky, Classics)
// ============================================================================

const THEME: EntityKindDefinition = {
  kind: "theme",
  label: "Theme",
  labelPlural: "Themes",
  category: "abstract",
  color: "#8b5cf6",
  icon: "Compass",
  description: "A major theme or philosophical concept",
  fields: [
    { id: "description", label: "Description", kind: "text" },
    { id: "symbols", label: "Associated Symbols", kind: "tags" },
    { id: "characters", label: "Character Embodiments", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "scenes", label: "Key Scenes", kind: "text" },
    { id: "thesis", label: "Thesis/Argument", kind: "text" },
    { id: "antithesis", label: "Antithesis", kind: "text" },
  ],
};

const SYMBOL: EntityKindDefinition = {
  kind: "symbol",
  label: "Symbol",
  labelPlural: "Symbols",
  category: "abstract",
  color: "#06b6d4",
  icon: "Feather",
  description: "A recurring symbol or motif",
  fields: [
    { id: "meaning", label: "Meaning", kind: "text" },
    { id: "appearances", label: "Appearances", kind: "text" },
    { id: "themes", label: "Related Themes", kind: "entity_ref_list", refEntityKinds: ["theme"] },
    { id: "evolution", label: "Evolution Through Story", kind: "text" },
  ],
};

const MORAL_DILEMMA: EntityKindDefinition = {
  kind: "dilemma",
  label: "Moral Dilemma",
  labelPlural: "Moral Dilemmas",
  category: "abstract",
  color: "#ef4444",
  icon: "Scale",
  description: "A moral or philosophical dilemma",
  fields: [
    { id: "question", label: "Central Question", kind: "text" },
    { id: "sides", label: "Opposing Sides", kind: "text" },
    { id: "characters", label: "Affected Characters", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "resolution", label: "Resolution", kind: "text", visibleIn: "dm" },
    { id: "authorPosition", label: "Author's Position", kind: "text", visibleIn: "dm" },
  ],
};

export const LITERARY_FICTION_TEMPLATE: ProjectTemplate = {
  id: "literary_fiction",
  name: "Literary Fiction",
  description:
    "For character-driven literary fiction, classics-inspired works, and philosophical narratives. Track themes, symbols, and moral complexity.",
  icon: "BookOpen",
  category: "literary",
  tags: ["literary", "classics", "faust", "dostoevsky", "kafka", "philosophical", "character study"],
  defaultGenre: "literary",
  suggestedGenres: ["literary", "mystery", "thriller", "horror"],
  defaultStyleMode: "hemingway",
  defaultArcTemplate: "tragic_fall",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    THEME,
    SYMBOL,
    MORAL_DILEMMA,
    EVENT_BASE,
    CONCEPT_BASE,
  ],
  defaultEntityKinds: ["character", "theme", "symbol"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    { kind: "embodies", label: "Embodies", category: "magical", color: "#8b5cf6", validTargetKinds: ["theme", "symbol"] },
    { kind: "contrasts_with", label: "Contrasts with", category: "conflict", color: "#ef4444", defaultBidirectional: true },
    { kind: "foil_to", label: "Foil to", category: "social", color: "#6b7280", defaultBidirectional: true },
    { kind: "symbolizes", label: "Symbolizes", category: "magical", color: "#06b6d4", validTargetKinds: ["symbol", "theme"] },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: false,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "symbolism_consistency",
      label: "Symbolism Consistency",
      description: "Track symbol usage and meaning consistency",
      defaultSeverity: "info",
      category: "consistency",
    },
    {
      id: "theme_tracking",
      label: "Theme Tracking",
      description: "Monitor thematic development",
      defaultSeverity: "info",
      category: "continuity",
    },
    {
      id: "show_dont_tell",
      label: "Show Don't Tell",
      description: "Flag excessive telling over showing",
      defaultSeverity: "warning",
      category: "style",
    },
  ],
};

// ============================================================================
// SCIENCE FICTION TEMPLATE
// ============================================================================

const TECHNOLOGY: EntityKindDefinition = {
  kind: "technology",
  label: "Technology",
  labelPlural: "Technologies",
  category: "system",
  color: "#3b82f6",
  icon: "Cpu",
  description: "A technology, invention, or scientific concept",
  fields: [
    { id: "type", label: "Type", kind: "enum", options: [
      { value: "propulsion", label: "Propulsion" },
      { value: "weapon", label: "Weapon" },
      { value: "medical", label: "Medical" },
      { value: "communication", label: "Communication" },
      { value: "energy", label: "Energy" },
      { value: "computing", label: "Computing" },
      { value: "biotech", label: "Biotech" },
      { value: "other", label: "Other" },
    ]},
    { id: "principles", label: "Scientific Principles", kind: "text" },
    { id: "limitations", label: "Limitations", kind: "tags" },
    { id: "implications", label: "Social Implications", kind: "text" },
    { id: "inventor", label: "Inventor", kind: "entity_ref", refEntityKinds: ["character", "faction"] },
  ],
};

const SPECIES: EntityKindDefinition = {
  kind: "species",
  label: "Species",
  labelPlural: "Species",
  category: "agent",
  color: "#22d3ee",
  icon: "Dna",
  description: "An alien species or subspecies",
  hasVisualDescription: true,
  fields: [
    { id: "homeworld", label: "Homeworld", kind: "entity_ref", refEntityKinds: ["location"] },
    { id: "physiology", label: "Physiology", kind: "text" },
    { id: "psychology", label: "Psychology", kind: "text" },
    { id: "society", label: "Society", kind: "text" },
    { id: "abilities", label: "Abilities", kind: "tags" },
    { id: "weaknesses", label: "Weaknesses", kind: "tags" },
    { id: "lifespan", label: "Lifespan", kind: "string" },
  ],
};

const PLANET: EntityKindDefinition = {
  kind: "planet",
  label: "Planet",
  labelPlural: "Planets",
  category: "place",
  color: "#22c55e",
  icon: "Globe2",
  description: "A planet, moon, or space station",
  fields: [
    { id: "type", label: "Type", kind: "enum", options: [
      { value: "terrestrial", label: "Terrestrial" },
      { value: "gas_giant", label: "Gas Giant" },
      { value: "ice_world", label: "Ice World" },
      { value: "desert", label: "Desert" },
      { value: "ocean", label: "Ocean" },
      { value: "station", label: "Space Station" },
      { value: "artificial", label: "Artificial" },
    ]},
    { id: "atmosphere", label: "Atmosphere", kind: "string" },
    { id: "population", label: "Population", kind: "string" },
    { id: "government", label: "Government", kind: "entity_ref", refEntityKinds: ["faction"] },
    { id: "resources", label: "Resources", kind: "tags" },
    { id: "nativeSpecies", label: "Native Species", kind: "entity_ref_list", refEntityKinds: ["species"] },
  ],
};

const STARSHIP: EntityKindDefinition = {
  kind: "starship",
  label: "Starship",
  labelPlural: "Starships",
  category: "object",
  color: "#6366f1",
  icon: "Rocket",
  description: "A spacecraft or starship",
  fields: [
    { id: "class", label: "Ship Class", kind: "string" },
    { id: "owner", label: "Owner", kind: "entity_ref", refEntityKinds: ["character", "faction"] },
    { id: "crew", label: "Crew", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "weapons", label: "Weapons", kind: "tags" },
    { id: "capabilities", label: "Capabilities", kind: "tags" },
    { id: "history", label: "History", kind: "text" },
  ],
};

export const SCIFI_TEMPLATE: ProjectTemplate = {
  id: "science_fiction",
  name: "Science Fiction",
  description:
    "For hard and soft science fiction, space opera, and speculative fiction. Track technologies, species, and worldbuilding at a galactic scale.",
  icon: "Rocket",
  category: "scifi",
  tags: ["scifi", "space opera", "cyberpunk", "hard sf", "aliens", "technology", "dune", "foundation"],
  defaultGenre: "science_fiction",
  suggestedGenres: ["science_fiction", "thriller", "horror"],
  defaultStyleMode: "hemingway",
  defaultArcTemplate: "three_act",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    PLANET,
    STARSHIP,
    TECHNOLOGY,
    SPECIES,
    FACTION_BASE,
    EVENT_BASE,
    CONCEPT_BASE,
  ],
  defaultEntityKinds: ["character", "planet", "technology", "faction"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    ...SPATIAL_RELATIONSHIPS,
    ...OWNERSHIP_RELATIONSHIPS,
    { kind: "orbits", label: "Orbits", category: "spatial", color: "#22c55e" },
    { kind: "crew_of", label: "Crew of", category: "professional", color: "#6366f1", validTargetKinds: ["starship"] },
    { kind: "invented", label: "Invented", inverseLabel: "Invented by", category: "ownership", color: "#3b82f6" },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: true,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "tech_consistency",
      label: "Technology Consistency",
      description: "Track technology rules and limitations",
      defaultSeverity: "warning",
      category: "consistency",
    },
    {
      id: "physics_consistency",
      label: "Physics Consistency",
      description: "Flag physics violations (optional)",
      defaultSeverity: "info",
      category: "consistency",
    },
  ],
};

// ============================================================================
// HORROR TEMPLATE
// ============================================================================

const CREATURE: EntityKindDefinition = {
  kind: "creature",
  label: "Creature",
  labelPlural: "Creatures",
  category: "agent",
  color: "#7c2d12",
  icon: "Ghost",
  description: "A monster, ghost, or horror entity",
  hasVisualDescription: true,
  hasStatus: true,
  fields: [
    { id: "type", label: "Type", kind: "enum", options: [
      { value: "ghost", label: "Ghost" },
      { value: "demon", label: "Demon" },
      { value: "undead", label: "Undead" },
      { value: "cosmic", label: "Cosmic Horror" },
      { value: "cryptid", label: "Cryptid" },
      { value: "cursed", label: "Cursed Human" },
      { value: "other", label: "Other" },
    ]},
    { id: "origin", label: "Origin", kind: "text" },
    { id: "powers", label: "Powers", kind: "tags" },
    { id: "weaknesses", label: "Weaknesses", kind: "tags", visibleIn: "dm" },
    { id: "motivation", label: "Motivation", kind: "text" },
    { id: "killCount", label: "Kill Count", kind: "number", visibleIn: "dm" },
    { id: "rules", label: "Rules (What It Can't Do)", kind: "text" },
  ],
};

const CURSE: EntityKindDefinition = {
  kind: "curse",
  label: "Curse",
  labelPlural: "Curses",
  category: "system",
  color: "#991b1b",
  icon: "AlertTriangle",
  description: "A curse, haunting, or supernatural affliction",
  fields: [
    { id: "origin", label: "Origin", kind: "text" },
    { id: "trigger", label: "Trigger", kind: "text" },
    { id: "effects", label: "Effects", kind: "text" },
    { id: "cure", label: "Cure", kind: "text", visibleIn: "dm" },
    { id: "victims", label: "Victims", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "rules", label: "Rules", kind: "text" },
  ],
};

export const HORROR_TEMPLATE: ProjectTemplate = {
  id: "horror",
  name: "Horror",
  description:
    "For horror, supernatural thriller, and dark fiction. Track creatures, curses, and maintain consistent terror rules.",
  icon: "Skull",
  category: "horror",
  tags: ["horror", "supernatural", "thriller", "lovecraft", "cosmic horror", "gothic", "slasher"],
  defaultGenre: "horror",
  suggestedGenres: ["horror", "thriller", "mystery", "grimdark"],
  defaultStyleMode: "noir",
  defaultArcTemplate: "three_act",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    CREATURE,
    CURSE,
    ITEM_BASE,
    EVENT_BASE,
    SYMBOL,
  ],
  defaultEntityKinds: ["character", "creature", "location", "curse"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    { kind: "haunts", label: "Haunts", category: "conflict", color: "#7c2d12" },
    { kind: "cursed_by", label: "Cursed by", inverseLabel: "Cursed", category: "conflict", color: "#991b1b" },
    { kind: "hunts", label: "Hunts", category: "conflict", color: "#ef4444" },
    { kind: "bound_to", label: "Bound to", category: "magical", color: "#a855f7" },
    { kind: "survived", label: "Survived", category: "conflict", color: "#22c55e", validSourceKinds: ["character"] },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: true,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "horror_rules",
      label: "Horror Rules",
      description: "Track creature/curse rules for consistency",
      defaultSeverity: "error",
      category: "consistency",
    },
    {
      id: "tension_tracking",
      label: "Tension Tracking",
      description: "Monitor tension and release pacing",
      defaultSeverity: "info",
      category: "pacing",
    },
  ],
};

// ============================================================================
// ROMANCE TEMPLATE
// ============================================================================

const RELATIONSHIP_ARC: EntityKindDefinition = {
  kind: "relationship_arc",
  label: "Relationship Arc",
  labelPlural: "Relationship Arcs",
  category: "narrative",
  color: "#ec4899",
  icon: "Heart",
  description: "A romantic or relationship arc between characters",
  fields: [
    { id: "participants", label: "Participants", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "type", label: "Type", kind: "enum", options: [
      { value: "romance", label: "Romance", color: "#ec4899" },
      { value: "enemies_to_lovers", label: "Enemies to Lovers", color: "#ef4444" },
      { value: "friends_to_lovers", label: "Friends to Lovers", color: "#22c55e" },
      { value: "forbidden", label: "Forbidden Love", color: "#a855f7" },
      { value: "second_chance", label: "Second Chance", color: "#f59e0b" },
      { value: "slow_burn", label: "Slow Burn", color: "#06b6d4" },
    ]},
    { id: "obstacles", label: "Obstacles", kind: "tags" },
    { id: "meetCute", label: "Meet Cute", kind: "text" },
    { id: "turningPoints", label: "Turning Points", kind: "text" },
    { id: "resolution", label: "Resolution", kind: "text", visibleIn: "dm" },
  ],
};

export const ROMANCE_TEMPLATE: ProjectTemplate = {
  id: "romance",
  name: "Romance",
  description:
    "For romance novels, romantic subplots, and relationship-focused fiction. Track relationship arcs, chemistry beats, and emotional development.",
  icon: "Heart",
  category: "literary",
  tags: ["romance", "love story", "contemporary", "historical romance", "paranormal romance"],
  defaultGenre: "romance",
  suggestedGenres: ["romance", "literary", "urban_fantasy"],
  defaultStyleMode: "hemingway",
  defaultArcTemplate: "three_act",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    RELATIONSHIP_ARC,
    EVENT_BASE,
  ],
  defaultEntityKinds: ["character", "relationship_arc", "location"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    { kind: "chemistry_with", label: "Chemistry with", category: "romantic", color: "#ec4899", defaultBidirectional: true },
    { kind: "jealous_of", label: "Jealous of", category: "conflict", color: "#22c55e" },
    { kind: "protective_of", label: "Protective of", category: "social", color: "#3b82f6" },
    { kind: "ex_of", label: "Ex of", category: "romantic", color: "#6b7280", defaultBidirectional: true },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: false,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "romance_beats",
      label: "Romance Beats",
      description: "Track romance trope progression",
      defaultSeverity: "info",
      category: "pacing",
    },
    {
      id: "chemistry_balance",
      label: "Chemistry Balance",
      description: "Balance tension and resolution",
      defaultSeverity: "info",
      category: "pacing",
    },
  ],
};

// ============================================================================
// MYSTERY / THRILLER TEMPLATE
// ============================================================================

const CLUE: EntityKindDefinition = {
  kind: "clue",
  label: "Clue",
  labelPlural: "Clues",
  category: "object",
  color: "#f59e0b",
  icon: "Search",
  description: "A clue or piece of evidence",
  fields: [
    { id: "discoveredBy", label: "Discovered By", kind: "entity_ref", refEntityKinds: ["character"] },
    { id: "discoveredIn", label: "Discovered In", kind: "entity_ref", refEntityKinds: ["location"] },
    { id: "pointsTo", label: "Points To", kind: "entity_ref_list", refEntityKinds: ["character", "event"] },
    { id: "redHerring", label: "Red Herring", kind: "boolean", visibleIn: "dm" },
    { id: "significance", label: "True Significance", kind: "text", visibleIn: "dm" },
  ],
};

const SUSPECT: EntityKindDefinition = {
  ...CHARACTER_BASE,
  kind: "suspect",
  label: "Suspect",
  labelPlural: "Suspects",
  color: "#ef4444",
  icon: "UserX",
  description: "A suspect in the mystery",
  fields: [
    ...CHARACTER_BASE.fields,
    { id: "motive", label: "Motive", kind: "text" },
    { id: "alibi", label: "Alibi", kind: "text" },
    { id: "guilty", label: "Guilty", kind: "boolean", visibleIn: "dm" },
    { id: "secrets", label: "Secrets", kind: "text", visibleIn: "dm" },
  ],
};

const CRIME: EntityKindDefinition = {
  kind: "crime",
  label: "Crime",
  labelPlural: "Crimes",
  category: "temporal",
  color: "#991b1b",
  icon: "AlertOctagon",
  description: "A crime or mystery to be solved",
  fields: [
    { id: "type", label: "Type", kind: "string" },
    { id: "victim", label: "Victim", kind: "entity_ref", refEntityKinds: ["character"] },
    { id: "location", label: "Location", kind: "entity_ref", refEntityKinds: ["location"] },
    { id: "time", label: "Time of Crime", kind: "string" },
    { id: "method", label: "Method", kind: "text", visibleIn: "dm" },
    { id: "perpetrator", label: "Perpetrator", kind: "entity_ref", refEntityKinds: ["character", "suspect"], visibleIn: "dm" },
    { id: "motive", label: "True Motive", kind: "text", visibleIn: "dm" },
  ],
};

export const MYSTERY_TEMPLATE: ProjectTemplate = {
  id: "mystery_thriller",
  name: "Mystery / Thriller",
  description:
    "For detective fiction, crime thrillers, and whodunits. Track clues, suspects, alibis, and red herrings with DM mode for the true solution.",
  icon: "Search",
  category: "literary",
  tags: ["mystery", "thriller", "detective", "crime", "noir", "whodunit", "suspense"],
  defaultGenre: "mystery",
  suggestedGenres: ["mystery", "thriller", "horror"],
  defaultStyleMode: "noir",
  defaultArcTemplate: "three_act",
  entityKinds: [
    CHARACTER_BASE,
    SUSPECT,
    LOCATION_BASE,
    CLUE,
    CRIME,
    EVENT_BASE,
  ],
  defaultEntityKinds: ["character", "suspect", "clue", "crime"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    { kind: "suspects", label: "Suspects", category: "conflict", color: "#ef4444" },
    { kind: "alibied_by", label: "Alibied by", category: "social", color: "#22c55e" },
    { kind: "witnessed", label: "Witnessed", category: "social", color: "#3b82f6" },
    { kind: "concealing", label: "Concealing", category: "conflict", color: "#a855f7", visibleIn: "dm" },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: true,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "clue_planting",
      label: "Clue Planting",
      description: "Track fair clue distribution",
      defaultSeverity: "info",
      category: "consistency",
    },
    {
      id: "timeline_airtight",
      label: "Airtight Timeline",
      description: "Ensure no timeline holes in alibi/crime",
      defaultSeverity: "error",
      category: "continuity",
    },
  ],
};

// ============================================================================
// SCREENPLAY TEMPLATE
// ============================================================================

const BEAT: EntityKindDefinition = {
  kind: "beat",
  label: "Beat",
  labelPlural: "Beats",
  category: "narrative",
  color: "#f97316",
  icon: "Music",
  description: "A story beat or dramatic moment",
  fields: [
    { id: "type", label: "Type", kind: "enum", options: [
      { value: "opening", label: "Opening Image" },
      { value: "catalyst", label: "Catalyst" },
      { value: "debate", label: "Debate" },
      { value: "break_into_2", label: "Break into 2" },
      { value: "midpoint", label: "Midpoint" },
      { value: "bad_guys_close_in", label: "Bad Guys Close In" },
      { value: "all_is_lost", label: "All Is Lost" },
      { value: "dark_night", label: "Dark Night of Soul" },
      { value: "break_into_3", label: "Break into 3" },
      { value: "finale", label: "Finale" },
      { value: "closing", label: "Closing Image" },
    ]},
    { id: "page", label: "Target Page", kind: "number" },
    { id: "description", label: "Description", kind: "text" },
    { id: "scenes", label: "Scenes", kind: "entity_ref_list", refEntityKinds: ["scene_entity"] },
  ],
};

const SCENE_ENTITY: EntityKindDefinition = {
  kind: "scene_entity",
  label: "Scene",
  labelPlural: "Scenes",
  category: "narrative",
  color: "#22c55e",
  icon: "Film",
  description: "A screenplay scene",
  fields: [
    { id: "intExt", label: "INT/EXT", kind: "enum", options: [
      { value: "int", label: "INT." },
      { value: "ext", label: "EXT." },
      { value: "int_ext", label: "INT./EXT." },
    ]},
    { id: "location", label: "Location", kind: "entity_ref", refEntityKinds: ["location"] },
    { id: "timeOfDay", label: "Time of Day", kind: "string" },
    { id: "characters", label: "Characters Present", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "purpose", label: "Scene Purpose", kind: "text" },
    { id: "conflict", label: "Conflict", kind: "text" },
    { id: "pageLength", label: "Est. Page Length", kind: "number" },
  ],
};

export const SCREENPLAY_TEMPLATE: ProjectTemplate = {
  id: "screenplay",
  name: "Screenplay",
  description:
    "For film and TV screenplays. Track beats, scenes, and proper formatting with Save the Cat structure support.",
  icon: "Clapperboard",
  category: "screenplay",
  tags: ["screenplay", "film", "television", "script", "save the cat", "screenwriting"],
  defaultGenre: "thriller",
  suggestedGenres: ["thriller", "horror", "romance", "mystery", "science_fiction"],
  defaultStyleMode: "minimalist",
  defaultArcTemplate: "save_the_cat",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    SCENE_ENTITY,
    BEAT,
    FACTION_BASE,
  ],
  defaultEntityKinds: ["character", "scene_entity", "beat", "location"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    { kind: "subplot_with", label: "Subplot with", category: "narrative", color: "#a855f7", defaultBidirectional: true },
  ],
  documentKinds: [
    {
      kind: "script",
      label: "Script",
      labelPlural: "Scripts",
      icon: "FileText",
      description: "Screenplay document",
      allowChildren: true,
      childKinds: ["act"],
    },
    {
      kind: "act",
      label: "Act",
      labelPlural: "Acts",
      icon: "Layers",
      description: "Screenplay act",
      allowChildren: true,
      childKinds: ["scene"],
    },
    ...PROSE_DOCUMENTS.filter((d) => d.kind !== "chapter"),
  ],
  defaultDocumentKind: "script",
  uiModules: [
    ...WRITER_UI_MODULES,
    { module: "scene_beats", enabled: true, order: 15 },
  ],
  defaultMode: "writer",
  dmModeEnabled: false,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "page_count",
      label: "Page Count",
      description: "Track page count and beat placement",
      defaultSeverity: "info",
      category: "pacing",
    },
    {
      id: "dialogue_balance",
      label: "Dialogue Balance",
      description: "Flag monologues and unbalanced dialogue",
      defaultSeverity: "warning",
      category: "style",
    },
  ],
};

// ============================================================================
// WEBNOVEL / SERIAL FICTION TEMPLATE
// ============================================================================

const POWER_SYSTEM: EntityKindDefinition = {
  kind: "power_system",
  label: "Power System",
  labelPlural: "Power Systems",
  category: "system",
  color: "#f97316",
  icon: "Zap",
  description: "A cultivation, leveling, or power system",
  fields: [
    { id: "ranks", label: "Ranks/Levels", kind: "tags" },
    { id: "source", label: "Power Source", kind: "string" },
    { id: "advancement", label: "Advancement Method", kind: "text" },
    { id: "bottlenecks", label: "Bottlenecks", kind: "tags" },
    { id: "costs", label: "Costs/Drawbacks", kind: "text" },
    { id: "maxPower", label: "Peak Power Level", kind: "number" },
  ],
};

const SKILL: EntityKindDefinition = {
  kind: "skill",
  label: "Skill",
  labelPlural: "Skills",
  category: "mechanical",
  color: "#a855f7",
  icon: "Sparkle",
  description: "A skill, ability, or technique in the power system",
  fields: [
    { id: "rank", label: "Rank", kind: "string" },
    { id: "users", label: "Users", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "requirements", label: "Requirements", kind: "tags" },
    { id: "effect", label: "Effect", kind: "text" },
    { id: "cooldown", label: "Cooldown/Cost", kind: "string" },
    { id: "evolution", label: "Evolution Path", kind: "entity_ref_list", refEntityKinds: ["skill"] },
  ],
};

export const WEBNOVEL_TEMPLATE: ProjectTemplate = {
  id: "webnovel_serial",
  name: "Webnovel / Serial Fiction",
  description:
    "For LitRPG, cultivation novels, progression fantasy, and serial webfiction. Track power systems, ranks, and chapter-by-chapter progression.",
  icon: "TrendingUp",
  category: "serial",
  tags: ["webnovel", "litrpg", "cultivation", "progression fantasy", "isekai", "system apocalypse", "serial"],
  defaultGenre: "litrpg",
  suggestedGenres: ["litrpg", "progression_fantasy", "manga_shounen", "high_fantasy"],
  defaultStyleMode: "manga",
  defaultArcTemplate: "three_act",
  entityKinds: [
    MANGA_CHARACTER,
    LOCATION_BASE,
    POWER_SYSTEM,
    SKILL,
    ITEM_BASE,
    FACTION_BASE,
    EVENT_BASE,
  ],
  defaultEntityKinds: ["character", "power_system", "skill", "faction"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    { kind: "power_level_above", label: "Stronger than", category: "mechanical", color: "#f97316" },
    { kind: "has_skill", label: "Has Skill", category: "mechanical", color: "#a855f7", validTargetKinds: ["skill"] },
    { kind: "cultivates", label: "Cultivates", category: "mechanical", color: "#8b5cf6", validTargetKinds: ["power_system"] },
  ],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: false,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "power_scaling",
      label: "Power Scaling",
      description: "Track power levels and prevent power creep",
      defaultSeverity: "error",
      category: "power_scaling",
    },
    {
      id: "rank_consistency",
      label: "Rank Consistency",
      description: "Ensure rank system is used consistently",
      defaultSeverity: "warning",
      category: "consistency",
    },
    {
      id: "chapter_hooks",
      label: "Chapter Hooks",
      description: "Track chapter ending hooks for serialization",
      defaultSeverity: "info",
      category: "pacing",
    },
  ],
};

// ============================================================================
// VISUAL NOVEL / INTERACTIVE FICTION TEMPLATE
// ============================================================================

const ROUTE: EntityKindDefinition = {
  kind: "route",
  label: "Route",
  labelPlural: "Routes",
  category: "narrative",
  color: "#ec4899",
  icon: "GitBranch",
  description: "A story route or path",
  fields: [
    { id: "mainCharacter", label: "Route Character", kind: "entity_ref", refEntityKinds: ["character"] },
    { id: "unlockConditions", label: "Unlock Conditions", kind: "text" },
    { id: "endings", label: "Possible Endings", kind: "tags" },
    { id: "keyChoices", label: "Key Choices", kind: "text" },
    { id: "themes", label: "Themes", kind: "tags" },
  ],
};

const CHOICE: EntityKindDefinition = {
  kind: "choice",
  label: "Choice",
  labelPlural: "Choices",
  category: "narrative",
  color: "#3b82f6",
  icon: "Split",
  description: "A branching choice point",
  fields: [
    { id: "options", label: "Options", kind: "tags" },
    { id: "consequences", label: "Consequences", kind: "text" },
    { id: "affectsRoutes", label: "Affects Routes", kind: "entity_ref_list", refEntityKinds: ["route"] },
    { id: "affectsCharacters", label: "Affects Characters", kind: "entity_ref_list", refEntityKinds: ["character"] },
    { id: "flags", label: "Sets Flags", kind: "tags" },
  ],
};

const ENDING: EntityKindDefinition = {
  kind: "ending",
  label: "Ending",
  labelPlural: "Endings",
  category: "narrative",
  color: "#22c55e",
  icon: "Flag",
  description: "A story ending",
  fields: [
    { id: "type", label: "Type", kind: "enum", options: [
      { value: "good", label: "Good Ending", color: "#22c55e" },
      { value: "true", label: "True Ending", color: "#f59e0b" },
      { value: "bad", label: "Bad Ending", color: "#ef4444" },
      { value: "neutral", label: "Neutral Ending", color: "#6b7280" },
      { value: "secret", label: "Secret Ending", color: "#a855f7" },
    ]},
    { id: "requirements", label: "Requirements", kind: "text" },
    { id: "route", label: "Route", kind: "entity_ref", refEntityKinds: ["route"] },
    { id: "description", label: "Description", kind: "text" },
  ],
};

export const VISUAL_NOVEL_TEMPLATE: ProjectTemplate = {
  id: "visual_novel",
  name: "Visual Novel / Interactive Fiction",
  description:
    "For branching narratives, dating sims, and choice-based games. Track routes, choices, flags, and multiple endings.",
  icon: "GitBranch",
  category: "visual",
  tags: ["visual novel", "interactive fiction", "dating sim", "choice", "branching", "twine", "renpy"],
  defaultGenre: "romance",
  suggestedGenres: ["romance", "mystery", "horror", "literary"],
  defaultStyleMode: "manga",
  defaultArcTemplate: "three_act",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    ROUTE,
    CHOICE,
    ENDING,
    EVENT_BASE,
  ],
  defaultEntityKinds: ["character", "route", "choice", "ending"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    { kind: "affection_level", label: "Affection Level", category: "romantic", color: "#ec4899" },
    { kind: "unlocks", label: "Unlocks", category: "mechanical", color: "#22c55e" },
    { kind: "blocks", label: "Blocks", category: "conflict", color: "#ef4444" },
  ],
  documentKinds: [
    {
      kind: "script",
      label: "Script",
      labelPlural: "Scripts",
      icon: "FileText",
      description: "VN script with markup",
      allowChildren: true,
      childKinds: ["scene"],
    },
    ...PROSE_DOCUMENTS.filter((d) => d.kind !== "chapter"),
  ],
  defaultDocumentKind: "script",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: true,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "route_consistency",
      label: "Route Consistency",
      description: "Track flag states and route logic",
      defaultSeverity: "error",
      category: "consistency",
    },
    {
      id: "ending_reachability",
      label: "Ending Reachability",
      description: "Ensure all endings are reachable",
      defaultSeverity: "warning",
      category: "consistency",
    },
  ],
};

// ============================================================================
// COMICS / GRAPHIC NOVEL TEMPLATE
// ============================================================================

const COMIC_PANEL: DocumentKindDefinition = {
  kind: "panel",
  label: "Panel",
  labelPlural: "Panels",
  icon: "Square",
  description: "A comic panel",
  allowChildren: false,
};

const COMIC_PAGE: DocumentKindDefinition = {
  kind: "page",
  label: "Page",
  labelPlural: "Pages",
  icon: "FileImage",
  description: "A comic page layout",
  allowChildren: true,
  childKinds: ["panel"],
};

const COMIC_ISSUE: DocumentKindDefinition = {
  kind: "issue",
  label: "Issue",
  labelPlural: "Issues",
  icon: "Book",
  description: "A comic issue",
  allowChildren: true,
  childKinds: ["page"],
};

export const COMICS_TEMPLATE: ProjectTemplate = {
  id: "comics_graphic_novel",
  name: "Comics / Graphic Novel",
  description:
    "For Western comics and graphic novels. Track issues, pages, panels, and visual storytelling with superhero or indie focus.",
  icon: "LayoutGrid",
  category: "visual",
  tags: ["comics", "graphic novel", "superhero", "indie comics", "marvel", "dc", "image"],
  defaultGenre: "science_fiction",
  suggestedGenres: ["science_fiction", "high_fantasy", "horror", "mystery"],
  defaultStyleMode: "minimalist",
  defaultArcTemplate: "three_act",
  entityKinds: [
    CHARACTER_BASE,
    LOCATION_BASE,
    ITEM_BASE,
    FACTION_BASE,
    EVENT_BASE,
    ARC,
  ],
  defaultEntityKinds: ["character", "location", "arc"],
  relationshipKinds: [
    ...FAMILIAL_RELATIONSHIPS,
    ...SOCIAL_RELATIONSHIPS,
    ...ORGANIZATIONAL_RELATIONSHIPS,
    { kind: "nemesis", label: "Nemesis", category: "conflict", color: "#ef4444", defaultBidirectional: true },
    { kind: "sidekick_of", label: "Sidekick of", inverseLabel: "Sidekick", category: "professional", color: "#3b82f6" },
    { kind: "secret_identity", label: "Secret Identity", category: "social", color: "#a855f7" },
  ],
  documentKinds: [
    COMIC_ISSUE,
    COMIC_PAGE,
    COMIC_PANEL,
    ...PROSE_DOCUMENTS.filter((d) => d.kind !== "chapter" && d.kind !== "scene"),
  ],
  defaultDocumentKind: "issue",
  uiModules: [
    ...WRITER_UI_MODULES,
    { module: "storyboard", enabled: true, order: 15 },
  ],
  defaultMode: "writer",
  dmModeEnabled: false,
  linterRules: [
    ...BASE_LINTER_RULES,
    {
      id: "panel_pacing",
      label: "Panel Pacing",
      description: "Track visual pacing and page turns",
      defaultSeverity: "info",
      category: "pacing",
    },
    {
      id: "dialogue_density",
      label: "Dialogue Density",
      description: "Flag text-heavy panels",
      defaultSeverity: "warning",
      category: "style",
    },
  ],
};

// ============================================================================
// BLANK TEMPLATE (Custom / Start from Scratch)
// ============================================================================

export const BLANK_TEMPLATE: ProjectTemplate = {
  id: "blank",
  name: "Blank Project",
  description:
    "Start from scratch with minimal defaults. Add entity kinds, relationships, and documents as needed for your unique project.",
  icon: "File",
  category: "custom",
  tags: ["blank", "custom", "empty", "minimal"],
  defaultGenre: "literary",
  suggestedGenres: [
    "high_fantasy",
    "urban_fantasy",
    "science_fiction",
    "horror",
    "mystery",
    "romance",
    "thriller",
    "literary",
  ],
  defaultStyleMode: "hemingway",
  defaultArcTemplate: "freeform",
  entityKinds: [CHARACTER_BASE, LOCATION_BASE, ITEM_BASE, CONCEPT_BASE],
  defaultEntityKinds: ["character", "location"],
  relationshipKinds: [...SOCIAL_RELATIONSHIPS, ...OWNERSHIP_RELATIONSHIPS],
  documentKinds: PROSE_DOCUMENTS,
  defaultDocumentKind: "chapter",
  uiModules: WRITER_UI_MODULES,
  defaultMode: "writer",
  dmModeEnabled: true,
  linterRules: BASE_LINTER_RULES,
};

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/** All builtin templates */
export const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  EPIC_FANTASY_TEMPLATE,
  WIZARDING_WORLD_TEMPLATE,
  DND_CAMPAIGN_TEMPLATE,
  MANGA_TEMPLATE,
  LITERARY_FICTION_TEMPLATE,
  SCIFI_TEMPLATE,
  HORROR_TEMPLATE,
  ROMANCE_TEMPLATE,
  MYSTERY_TEMPLATE,
  SCREENPLAY_TEMPLATE,
  WEBNOVEL_TEMPLATE,
  VISUAL_NOVEL_TEMPLATE,
  COMICS_TEMPLATE,
  BLANK_TEMPLATE,
];

/** Get template by ID */
export function getTemplate(id: string): ProjectTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

/** Get templates by category */
export function getTemplatesByCategory(
  category: ProjectTemplate["category"]
): ProjectTemplate[] {
  return BUILTIN_TEMPLATES.filter((t) => t.category === category);
}

/** Search templates by query */
export function searchTemplates(query: string): ProjectTemplate[] {
  const q = query.toLowerCase();
  return BUILTIN_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q))
  );
}

/** Get all unique genres across all templates */
export function getAllTemplateGenres(): string[] {
  const genres = new Set<string>();
  for (const template of BUILTIN_TEMPLATES) {
    if (template.defaultGenre) {
      genres.add(template.defaultGenre);
    }
    if (template.suggestedGenres) {
      template.suggestedGenres.forEach((g) => genres.add(g));
    }
  }
  return Array.from(genres).sort();
}
