export const PROJECT_TEMPLATE_IDS = [
  "writer",
  "product",
  "engineering",
  "design",
  "comms",
  "custom",
] as const;

export type ProjectTemplateId = (typeof PROJECT_TEMPLATE_IDS)[number];

export type TemplateRiskLevel = "low" | "high" | "core";

export type TemplateApprovalConfig = {
  identityFields?: readonly string[];
  updateAlwaysRequiresApproval?: boolean;
  createRequiresApproval?: boolean;
};

export type TemplateTypeDef = {
  type: string;
  displayName: string;
  riskLevel?: TemplateRiskLevel;
  schema?: unknown;
  icon?: string;
  color?: string;
  approval?: TemplateApprovalConfig;
};

export type TemplateRelationshipTypeDef = Omit<TemplateTypeDef, "icon" | "color">;

export type TemplateDocumentKind = {
  type: string;
  displayName: string;
  schema?: unknown;
  icon?: string;
  color?: string;
};

export type TemplateTaskDefaults = Record<
  string,
  {
    temperature?: number;
    model?: string;
    responseFormat?: "text" | "json_object" | "json_schema";
  }
>;

export type ProjectTemplate = {
  id: ProjectTemplateId;
  label: string;
  entityTypes: TemplateTypeDef[];
  relationshipTypes: TemplateRelationshipTypeDef[];
  documentKinds?: TemplateDocumentKind[];
  capabilityIds?: string[];
  taskDefaults?: TemplateTaskDefaults;
};

export const DEFAULT_TEMPLATE_ID: ProjectTemplateId = "writer";

const WRITER_IDENTITY_FIELDS = ["name", "properties"] as const;

// =============================================================================
// Writer Entity Types (NO hardcoded schemas - schemas come from registry)
// =============================================================================

const WRITER_ENTITY_TYPES: TemplateTypeDef[] = [
  {
    type: "character",
    displayName: "Character",
    riskLevel: "core",
    icon: "User",
    color: "#22d3ee",
    approval: { identityFields: WRITER_IDENTITY_FIELDS },
  },
  {
    type: "location",
    displayName: "Location",
    riskLevel: "low",
    icon: "MapPin",
    color: "#22c55e",
  },
  {
    type: "item",
    displayName: "Item",
    riskLevel: "low",
    icon: "Sword",
    color: "#f59e0b",
  },
  {
    type: "faction",
    displayName: "Faction",
    riskLevel: "core",
    icon: "Building2",
    color: "#a855f7",
    approval: { identityFields: WRITER_IDENTITY_FIELDS },
  },
  {
    type: "magic_system",
    displayName: "Magic System",
    riskLevel: "core",
    icon: "Wand2",
    color: "#8b5cf6",
    approval: { identityFields: WRITER_IDENTITY_FIELDS },
  },
  {
    type: "event",
    displayName: "Event",
    riskLevel: "low",
    icon: "Calendar",
    color: "#f97316",
  },
  {
    type: "concept",
    displayName: "Concept",
    riskLevel: "low",
    icon: "Sparkles",
    color: "#64748b",
  },
];

const WRITER_RELATIONSHIP_TYPES: TemplateRelationshipTypeDef[] = [
  { type: "knows", displayName: "Knows", riskLevel: "low" },
  { type: "loves", displayName: "Loves", riskLevel: "low" },
  { type: "hates", displayName: "Hates", riskLevel: "low" },
  { type: "killed", displayName: "Killed", riskLevel: "core" },
  { type: "created", displayName: "Created", riskLevel: "core" },
  { type: "owns", displayName: "Owns", riskLevel: "low" },
  { type: "guards", displayName: "Guards", riskLevel: "low" },
  { type: "weakness", displayName: "Weakness", riskLevel: "low" },
  { type: "strength", displayName: "Strength", riskLevel: "low" },
  { type: "parent_of", displayName: "Parent Of", riskLevel: "core" },
  { type: "child_of", displayName: "Child Of", riskLevel: "core" },
  { type: "sibling_of", displayName: "Sibling Of", riskLevel: "core" },
  { type: "married_to", displayName: "Married To", riskLevel: "core" },
  { type: "allied_with", displayName: "Allied With", riskLevel: "low" },
  { type: "enemy_of", displayName: "Enemy Of", riskLevel: "low" },
  { type: "member_of", displayName: "Member Of", riskLevel: "high" },
  { type: "rules", displayName: "Rules", riskLevel: "high" },
  { type: "serves", displayName: "Serves", riskLevel: "high" },
];

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplate> = {
  writer: {
    id: "writer",
    label: "Writer",
    entityTypes: WRITER_ENTITY_TYPES,
    relationshipTypes: WRITER_RELATIONSHIP_TYPES,
    documentKinds: [
      { type: "chapter", displayName: "Chapter" },
      { type: "scene", displayName: "Scene" },
      { type: "note", displayName: "Note" },
      { type: "outline", displayName: "Outline" },
      { type: "worldbuilding", displayName: "Worldbuilding" },
    ],
  },
  product: {
    id: "product",
    label: "Product",
    entityTypes: [
      {
        type: "epic",
        displayName: "Epic",
        riskLevel: "high",
        icon: "Flag",
        color: "#f97316",
      },
      {
        type: "feature",
        displayName: "Feature",
        riskLevel: "high",
        icon: "Sparkles",
        color: "#22c55e",
      },
      {
        type: "requirement",
        displayName: "Requirement",
        riskLevel: "high",
        icon: "ListChecks",
        color: "#eab308",
      },
      {
        type: "persona",
        displayName: "Persona",
        riskLevel: "low",
        icon: "User",
        color: "#38bdf8",
      },
      {
        type: "metric",
        displayName: "Metric",
        riskLevel: "low",
        icon: "Gauge",
        color: "#a855f7",
      },
      {
        type: "release",
        displayName: "Release",
        riskLevel: "high",
        icon: "Rocket",
        color: "#f43f5e",
      },
    ],
    relationshipTypes: [
      { type: "depends_on", displayName: "Depends On", riskLevel: "high" },
      { type: "blocks", displayName: "Blocks", riskLevel: "high" },
      { type: "owned_by", displayName: "Owned By", riskLevel: "low" },
      { type: "relates_to", displayName: "Relates To", riskLevel: "low" },
      { type: "ships_in", displayName: "Ships In", riskLevel: "high" },
    ],
    documentKinds: [
      { type: "prd", displayName: "PRD" },
      { type: "spec", displayName: "Spec" },
      { type: "brief", displayName: "Brief" },
      { type: "roadmap", displayName: "Roadmap" },
      { type: "note", displayName: "Note" },
    ],
  },
  engineering: {
    id: "engineering",
    label: "Engineering",
    entityTypes: [
      {
        type: "service",
        displayName: "Service",
        riskLevel: "high",
        icon: "Server",
        color: "#0ea5e9",
      },
      {
        type: "endpoint",
        displayName: "Endpoint",
        riskLevel: "low",
        icon: "Link",
        color: "#14b8a6",
      },
      {
        type: "database",
        displayName: "Database",
        riskLevel: "high",
        icon: "Database",
        color: "#6366f1",
      },
      {
        type: "incident",
        displayName: "Incident",
        riskLevel: "core",
        icon: "AlertTriangle",
        color: "#ef4444",
      },
      {
        type: "runbook",
        displayName: "Runbook",
        riskLevel: "low",
        icon: "BookOpen",
        color: "#84cc16",
      },
    ],
    relationshipTypes: [
      { type: "calls", displayName: "Calls", riskLevel: "low" },
      { type: "depends_on", displayName: "Depends On", riskLevel: "high" },
      { type: "owns", displayName: "Owns", riskLevel: "low" },
      { type: "impacts", displayName: "Impacts", riskLevel: "high" },
      { type: "runbook_for", displayName: "Runbook For", riskLevel: "low" },
    ],
    documentKinds: [
      { type: "tech_spec", displayName: "Tech Spec" },
      { type: "runbook", displayName: "Runbook" },
      { type: "incident", displayName: "Incident" },
      { type: "note", displayName: "Note" },
    ],
  },
  design: {
    id: "design",
    label: "Design",
    entityTypes: [
      {
        type: "component",
        displayName: "Component",
        riskLevel: "low",
        icon: "Box",
        color: "#10b981",
      },
      {
        type: "screen",
        displayName: "Screen",
        riskLevel: "low",
        icon: "Monitor",
        color: "#3b82f6",
      },
      {
        type: "token",
        displayName: "Token",
        riskLevel: "low",
        icon: "Palette",
        color: "#f59e0b",
      },
      {
        type: "pattern",
        displayName: "Pattern",
        riskLevel: "low",
        icon: "Shapes",
        color: "#a855f7",
      },
      {
        type: "guideline",
        displayName: "Guideline",
        riskLevel: "low",
        icon: "ClipboardList",
        color: "#64748b",
      },
    ],
    relationshipTypes: [
      { type: "uses", displayName: "Uses", riskLevel: "low" },
      { type: "contains", displayName: "Contains", riskLevel: "low" },
      { type: "variant_of", displayName: "Variant Of", riskLevel: "low" },
      { type: "implements", displayName: "Implements", riskLevel: "low" },
      { type: "relates_to", displayName: "Relates To", riskLevel: "low" },
    ],
    documentKinds: [
      { type: "design_brief", displayName: "Design Brief" },
      { type: "spec", displayName: "Spec" },
      { type: "note", displayName: "Note" },
    ],
  },
  comms: {
    id: "comms",
    label: "Comms",
    entityTypes: [
      {
        type: "campaign",
        displayName: "Campaign",
        riskLevel: "high",
        icon: "Megaphone",
        color: "#f97316",
      },
      {
        type: "message",
        displayName: "Message",
        riskLevel: "low",
        icon: "MessageSquare",
        color: "#22c55e",
      },
      {
        type: "asset",
        displayName: "Asset",
        riskLevel: "low",
        icon: "Image",
        color: "#38bdf8",
      },
      {
        type: "audience",
        displayName: "Audience",
        riskLevel: "low",
        icon: "Users",
        color: "#a855f7",
      },
      {
        type: "channel",
        displayName: "Channel",
        riskLevel: "low",
        icon: "Radio",
        color: "#eab308",
      },
    ],
    relationshipTypes: [
      { type: "targets", displayName: "Targets", riskLevel: "high" },
      { type: "published_on", displayName: "Published On", riskLevel: "low" },
      { type: "supports", displayName: "Supports", riskLevel: "low" },
      { type: "measured_by", displayName: "Measured By", riskLevel: "low" },
    ],
    documentKinds: [
      { type: "brief", displayName: "Brief" },
      { type: "press_release", displayName: "Press Release" },
      { type: "blog", displayName: "Blog" },
      { type: "note", displayName: "Note" },
    ],
  },
  custom: {
    id: "custom",
    label: "Custom",
    entityTypes: [],
    relationshipTypes: [],
  },
};

export function getProjectTemplate(
  templateId: ProjectTemplateId | string | undefined
): ProjectTemplate {
  if (!templateId) return PROJECT_TEMPLATES[DEFAULT_TEMPLATE_ID];
  const known = PROJECT_TEMPLATES[templateId as ProjectTemplateId];
  return known ?? PROJECT_TEMPLATES[DEFAULT_TEMPLATE_ID];
}

export function listProjectTemplates(): ProjectTemplate[] {
  return Object.values(PROJECT_TEMPLATES);
}
