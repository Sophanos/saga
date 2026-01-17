import type {
  TemplateDocumentKind,
  TemplateEntityKind,
  TemplateLinterRule,
  TemplateRelationshipKind,
  TemplateUIModule,
} from "../../../packages/agent-protocol/src/tools";

export type DomainKey = "story" | "product" | "engineering" | "design" | "comms" | "cinema";

export type DomainBlueprint = {
  label: string;
  summary: string;
  tags: string[];
  entityKindSeeds: Array<{ kind: string; label: string; category: TemplateEntityKind["category"] }>;
  relationshipKindSeeds: Array<{ kind: string; label: string; category: TemplateRelationshipKind["category"] }>;
  documentKindSeeds: TemplateDocumentKind[];
  uiModuleSeeds: TemplateUIModule[];
  linterRuleSeeds: TemplateLinterRule[];
};

export const ENTITY_CATEGORY_VALUES: TemplateEntityKind["category"][] = [
  "agent",
  "place",
  "object",
  "system",
  "organization",
  "temporal",
  "abstract",
];

export const RELATIONSHIP_CATEGORY_VALUES: TemplateRelationshipKind["category"][] = [
  "interpersonal",
  "familial",
  "power",
  "ability",
  "custom",
];

export const FIELD_KIND_VALUES: TemplateEntityKind["fields"][number]["kind"][] = [
  "string",
  "text",
  "number",
  "boolean",
  "enum",
  "tags",
  "entity_ref",
];

export const LINTER_SEVERITY_VALUES: TemplateLinterRule["defaultSeverity"][] = [
  "error",
  "warning",
  "info",
];

export const LINTER_CATEGORY_VALUES: TemplateLinterRule["category"][] = [
  "character",
  "world",
  "plot",
  "timeline",
  "style",
];

export const UI_MODULE_ALLOWLIST = new Set<string>([
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
  "outline",
  "character_arcs",
  "scene_beats",
]);

export const ENTITY_CATEGORY_COLORS: Record<TemplateEntityKind["category"], string> = {
  agent: "#f97316",
  place: "#06b6d4",
  object: "#f59e0b",
  system: "#8b5cf6",
  organization: "#10b981",
  temporal: "#6366f1",
  abstract: "#64748b",
};

export const DOMAIN_BLUEPRINTS: Record<DomainKey, DomainBlueprint> = {
  story: {
    label: "Story / World",
    summary: "Fictional worlds with characters, locations, and narrative arcs.",
    tags: ["story", "world", "character", "arc", "lore"],
    entityKindSeeds: [
      { kind: "character", label: "Character", category: "agent" },
      { kind: "location", label: "Location", category: "place" },
      { kind: "faction", label: "Faction", category: "organization" },
      { kind: "magic_system", label: "Magic System", category: "system" },
      { kind: "artifact", label: "Artifact", category: "object" },
      { kind: "event", label: "Event", category: "temporal" },
    ],
    relationshipKindSeeds: [
      { kind: "allied_with", label: "Allied With", category: "interpersonal" },
      { kind: "enemy_of", label: "Enemy Of", category: "power" },
      { kind: "mentors", label: "Mentors", category: "familial" },
      { kind: "located_in", label: "Located In", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "chapter", label: "Chapter", allowChildren: true },
      { kind: "scene", label: "Scene", allowChildren: false },
      { kind: "worldbuilding", label: "World Note", allowChildren: false },
      { kind: "timeline", label: "Timeline", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
      { module: "codex", enabled: true, order: 5 },
    ],
    linterRuleSeeds: [
      {
        id: "character_consistency",
        label: "Character Consistency",
        description: "Keep character motivations and traits consistent across scenes.",
        defaultSeverity: "warning",
        category: "character",
      },
      {
        id: "world_rules",
        label: "World Rules",
        description: "Ensure magic or tech rules remain consistent.",
        defaultSeverity: "warning",
        category: "world",
      },
      {
        id: "plot_continuity",
        label: "Plot Continuity",
        description: "Avoid timeline contradictions and plot holes.",
        defaultSeverity: "warning",
        category: "plot",
      },
    ],
  },
  product: {
    label: "Product",
    summary: "Product strategy, features, and releases.",
    tags: ["product", "roadmap", "feature", "persona"],
    entityKindSeeds: [
      { kind: "persona", label: "Persona", category: "agent" },
      { kind: "feature", label: "Feature", category: "object" },
      { kind: "epic", label: "Epic", category: "temporal" },
      { kind: "metric", label: "Metric", category: "abstract" },
      { kind: "release", label: "Release", category: "temporal" },
      { kind: "market", label: "Market", category: "organization" },
    ],
    relationshipKindSeeds: [
      { kind: "depends_on", label: "Depends On", category: "custom" },
      { kind: "owned_by", label: "Owned By", category: "power" },
      { kind: "ships_in", label: "Ships In", category: "custom" },
      { kind: "measured_by", label: "Measured By", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "prd", label: "PRD", allowChildren: false },
      { kind: "spec", label: "Spec", allowChildren: false },
      { kind: "roadmap", label: "Roadmap", allowChildren: false },
      { kind: "release_notes", label: "Release Notes", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
      { module: "console", enabled: true, order: 5 },
    ],
    linterRuleSeeds: [
      {
        id: "user_focus",
        label: "User Focus",
        description: "Ensure each feature references a primary user or persona.",
        defaultSeverity: "warning",
        category: "character",
      },
      {
        id: "metric_alignment",
        label: "Metric Alignment",
        description: "Tie initiatives to measurable outcomes.",
        defaultSeverity: "info",
        category: "plot",
      },
    ],
  },
  engineering: {
    label: "Engineering",
    summary: "Systems, services, and operational plans.",
    tags: ["service", "architecture", "runbook", "reliability"],
    entityKindSeeds: [
      { kind: "service", label: "Service", category: "system" },
      { kind: "api", label: "API Endpoint", category: "object" },
      { kind: "database", label: "Database", category: "place" },
      { kind: "incident", label: "Incident", category: "temporal" },
      { kind: "runbook", label: "Runbook", category: "system" },
      { kind: "environment", label: "Environment", category: "system" },
    ],
    relationshipKindSeeds: [
      { kind: "calls", label: "Calls", category: "custom" },
      { kind: "depends_on", label: "Depends On", category: "power" },
      { kind: "impacts", label: "Impacts", category: "custom" },
      { kind: "owned_by", label: "Owned By", category: "power" },
    ],
    documentKindSeeds: [
      { kind: "architecture", label: "Architecture", allowChildren: false },
      { kind: "runbook", label: "Runbook", allowChildren: false },
      { kind: "postmortem", label: "Postmortem", allowChildren: false },
      { kind: "spec", label: "Spec", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
      { module: "console", enabled: true, order: 5 },
    ],
    linterRuleSeeds: [
      {
        id: "reliability_targets",
        label: "Reliability Targets",
        description: "Document SLAs and error budgets for critical services.",
        defaultSeverity: "warning",
        category: "timeline",
      },
      {
        id: "ownership_clarity",
        label: "Ownership Clarity",
        description: "Every service should have a clear owner or team.",
        defaultSeverity: "info",
        category: "style",
      },
    ],
  },
  design: {
    label: "Design",
    summary: "Design systems, screens, and visual language.",
    tags: ["design", "system", "component", "visual"],
    entityKindSeeds: [
      { kind: "component", label: "Component", category: "object" },
      { kind: "screen", label: "Screen", category: "place" },
      { kind: "token", label: "Token", category: "system" },
      { kind: "pattern", label: "Pattern", category: "abstract" },
      { kind: "guideline", label: "Guideline", category: "system" },
    ],
    relationshipKindSeeds: [
      { kind: "uses", label: "Uses", category: "custom" },
      { kind: "variant_of", label: "Variant Of", category: "custom" },
      { kind: "composed_of", label: "Composed Of", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "design_brief", label: "Design Brief", allowChildren: false },
      { kind: "spec", label: "Spec", allowChildren: false },
      { kind: "guidelines", label: "Guidelines", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "console", enabled: true, order: 4 },
    ],
    linterRuleSeeds: [
      {
        id: "consistency_tokens",
        label: "Token Consistency",
        description: "Ensure design tokens are referenced consistently.",
        defaultSeverity: "warning",
        category: "style",
      },
    ],
  },
  comms: {
    label: "Communications",
    summary: "Messaging, campaigns, and channel strategy.",
    tags: ["comms", "campaign", "message", "audience"],
    entityKindSeeds: [
      { kind: "campaign", label: "Campaign", category: "system" },
      { kind: "message", label: "Message", category: "abstract" },
      { kind: "audience", label: "Audience", category: "organization" },
      { kind: "channel", label: "Channel", category: "system" },
      { kind: "asset", label: "Asset", category: "object" },
    ],
    relationshipKindSeeds: [
      { kind: "targets", label: "Targets", category: "custom" },
      { kind: "published_on", label: "Published On", category: "custom" },
      { kind: "measured_by", label: "Measured By", category: "custom" },
    ],
    documentKindSeeds: [
      { kind: "campaign_brief", label: "Campaign Brief", allowChildren: false },
      { kind: "content_calendar", label: "Content Calendar", allowChildren: false },
      { kind: "press_release", label: "Press Release", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "project_graph", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
    ],
    linterRuleSeeds: [
      {
        id: "message_clarity",
        label: "Message Clarity",
        description: "Ensure key messages stay concise and consistent.",
        defaultSeverity: "warning",
        category: "style",
      },
    ],
  },
  cinema: {
    label: "Cinema / Film",
    summary: "Screen stories, scenes, and production planning.",
    tags: ["cinema", "screenplay", "scene", "shot"],
    entityKindSeeds: [
      { kind: "character", label: "Character", category: "agent" },
      { kind: "location", label: "Location", category: "place" },
      { kind: "scene", label: "Scene", category: "temporal" },
      { kind: "shot", label: "Shot", category: "temporal" },
      { kind: "prop", label: "Prop", category: "object" },
      { kind: "crew_role", label: "Crew Role", category: "organization" },
    ],
    relationshipKindSeeds: [
      { kind: "appears_in", label: "Appears In", category: "custom" },
      { kind: "transitions_to", label: "Transitions To", category: "custom" },
      { kind: "motivates", label: "Motivates", category: "interpersonal" },
    ],
    documentKindSeeds: [
      { kind: "screenplay", label: "Screenplay", allowChildren: false },
      { kind: "scene_breakdown", label: "Scene Breakdown", allowChildren: false },
      { kind: "shot_list", label: "Shot List", allowChildren: false },
      { kind: "production_notes", label: "Production Notes", allowChildren: false },
    ],
    uiModuleSeeds: [
      { module: "editor", enabled: true, order: 1 },
      { module: "manifest", enabled: true, order: 2 },
      { module: "storyboard", enabled: true, order: 3 },
      { module: "timeline", enabled: true, order: 4 },
    ],
    linterRuleSeeds: [
      {
        id: "scene_coverage",
        label: "Scene Coverage",
        description: "Scenes should list required locations and props.",
        defaultSeverity: "info",
        category: "timeline",
      },
    ],
  },
};
