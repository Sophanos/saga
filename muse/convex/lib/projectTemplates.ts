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

const WRITER_IDENTITY_FIELDS = ["name", "archetype", "backstory", "goals"] as const;

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
      { type: "epic", displayName: "Epic", riskLevel: "high" },
      { type: "feature", displayName: "Feature", riskLevel: "high" },
      { type: "requirement", displayName: "Requirement", riskLevel: "high" },
      { type: "persona", displayName: "Persona", riskLevel: "low" },
      { type: "metric", displayName: "Metric", riskLevel: "low" },
      { type: "release", displayName: "Release", riskLevel: "high" },
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
      { type: "service", displayName: "Service", riskLevel: "high" },
      { type: "endpoint", displayName: "Endpoint", riskLevel: "low" },
      { type: "database", displayName: "Database", riskLevel: "high" },
      { type: "incident", displayName: "Incident", riskLevel: "core" },
      { type: "runbook", displayName: "Runbook", riskLevel: "low" },
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
      { type: "component", displayName: "Component", riskLevel: "low" },
      { type: "screen", displayName: "Screen", riskLevel: "low" },
      { type: "token", displayName: "Token", riskLevel: "low" },
      { type: "pattern", displayName: "Pattern", riskLevel: "low" },
      { type: "guideline", displayName: "Guideline", riskLevel: "low" },
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
      { type: "campaign", displayName: "Campaign", riskLevel: "high" },
      { type: "message", displayName: "Message", riskLevel: "low" },
      { type: "asset", displayName: "Asset", riskLevel: "low" },
      { type: "audience", displayName: "Audience", riskLevel: "low" },
      { type: "channel", displayName: "Channel", riskLevel: "low" },
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
