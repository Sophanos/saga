/**
 * Central capability registry.
 *
 * All AI capabilities are defined here as the single source of truth.
 * QuickActions, Command Palette, and Chat UI all derive from this registry.
 */

import type { Capability, CapabilitySurface, ToolCapability, CapabilityContext, WidgetCapability } from "./types";

export type ProjectTemplateId =
  | "writer"
  | "product"
  | "engineering"
  | "design"
  | "comms"
  | "custom";

// =============================================================================
// Capability Registry
// =============================================================================

const CAPABILITIES_BASE: Capability[] = [
  // ---------------------------------------------------------------------------
  // UI Actions (Navigation)
  // ---------------------------------------------------------------------------
  {
    id: "ai.chat",
    kind: "ui",
    label: "Ask AI",
    description: "Open AI chat to ask questions about your project",
    icon: "MessageSquare",
    category: "navigation",
    surfaces: ["command_palette"],
    requiresProject: true,
    keywords: ["chat", "ai", "ask", "question", "help", "assistant"],
    shortcut: "⌘/",
    order: 10,
    action: { type: "open_console_tab", tab: "chat" },
  },
  {
    id: "ai.lint",
    kind: "ui",
    label: "Check Consistency",
    description: "Run AI linter to check for consistency issues",
    icon: "AlertTriangle",
    category: "analysis",
    surfaces: ["command_palette"],
    requiresProject: true,
    keywords: ["lint", "check", "consistency", "errors", "issues", "validate"],
    shortcut: "⌘⇧L",
    order: 20,
    action: { type: "open_console_tab", tab: "linter" },
  },
  {
    id: "ai.coach",
    kind: "ui",
    label: "Review Coach",
    description: "Get AI feedback on clarity, structure, and tone",
    icon: "Brain",
    category: "analysis",
    surfaces: ["command_palette"],
    requiresProject: true,
    keywords: ["review", "clarity", "coach", "feedback", "structure", "tone"],
    order: 30,
    action: { type: "open_console_tab", tab: "coach" },
  },
  {
    id: "ai.dynamics",
    kind: "ui",
    label: "Entity Dynamics",
    description: "Analyze interactions and relationships between entities",
    icon: "Zap",
    category: "analysis",
    surfaces: ["command_palette"],
    requiresProject: true,
    keywords: ["dynamics", "interactions", "relationships", "extract"],
    order: 40,
    action: { type: "open_console_tab", tab: "dynamics" },
  },
  {
    id: "profile.open",
    kind: "ui",
    label: "Profile Settings",
    description: "Manage your profile and preferences",
    icon: "User",
    category: "navigation",
    surfaces: ["command_palette"],
    keywords: ["profile", "settings", "preferences", "genre", "culture"],
    order: 100,
    action: { type: "open_modal", modal: "profile" },
  },
  {
    id: "file.import",
    kind: "ui",
    label: "Import Story",
    description: "Import content from external files",
    icon: "FileUp",
    category: "navigation",
    surfaces: ["command_palette", "slash_menu"],
    requiresProject: true,
    keywords: ["import", "upload", "file", "docx", "epub", "markdown", "txt"],
    shortcut: "⌘⇧I",
    order: 105,
    action: { type: "open_modal", modal: "import" },
  },
  {
    id: "file.export",
    kind: "ui",
    label: "Export Story",
    description: "Export your story to PDF, DOCX, EPUB, or Markdown",
    icon: "FileDown",
    category: "navigation",
    surfaces: ["command_palette", "slash_menu"],
    requiresProject: true,
    keywords: ["export", "download", "pdf", "docx", "epub", "markdown"],
    shortcut: "⌘⇧E",
    order: 106,
    action: { type: "open_modal", modal: "export" },
  },

  // ---------------------------------------------------------------------------
  // Chat Prompts (Quick Actions)
  // ---------------------------------------------------------------------------
  {
    id: "prompt.describe",
    kind: "chat_prompt",
    label: "Describe",
    description: "Describe what's happening in the selected text",
    icon: "Sparkles",
    category: "generation",
    surfaces: ["quick_actions"],
    requiresSelection: true,
    requiresProject: true,
    order: 10,
    buildPrompt: () =>
      "Describe what's happening in the selected text in vivid detail.",
  },
  {
    id: "prompt.detect-entities",
    kind: "chat_prompt",
    label: "Extract Entities",
    description: "Extract entities and relationships from the document",
    icon: "ScanSearch",
    category: "knowledge",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    keywords: ["detect", "entity", "extract", "selection", "ai"],
    order: 20,
    buildPrompt: () =>
      "Analyze the current document and extract entities and relationships that should be tracked in the project graph.",
  },
  {
    id: "prompt.create-character",
    kind: "chat_prompt",
    label: "Create Entity",
    description: "Help create a new entity based on project context",
    icon: "User",
    category: "knowledge",
    surfaces: ["quick_actions"],
    requiresProject: true,
    order: 30,
    buildPrompt: () =>
      "Help me create a new entity based on the current project context. Ask me about its role, attributes, and relationships.",
  },
  {
    id: "prompt.relationships",
    kind: "chat_prompt",
    label: "Suggest Relationships",
    description: "Suggest relationships between entities",
    icon: "GitBranch",
    category: "knowledge",
    surfaces: ["quick_actions"],
    requiresProject: true,
    order: 40,
    buildPrompt: () =>
      "Analyze the entities in my project and suggest relationships between them. Consider dependencies, collaborations, and conflicts.",
  },
  {
    id: "prompt.backstory",
    kind: "chat_prompt",
    label: "Background",
    description: "Generate background for the selected element",
    icon: "BookOpen",
    category: "generation",
    surfaces: ["quick_actions"],
    requiresSelection: true,
    requiresProject: true,
    order: 50,
    buildPrompt: () =>
      "Generate a concise background for the element in the selected text and how it fits the project context.",
  },
  {
    id: "prompt.next-steps",
    kind: "chat_prompt",
    label: "Next Steps",
    description: "Suggest possible next steps for the project",
    icon: "Lightbulb",
    category: "generation",
    surfaces: ["quick_actions"],
    requiresProject: true,
    order: 70,
    buildPrompt: () =>
      "Based on the current project, suggest 3-5 possible next steps. Consider priorities, dependencies, and open questions.",
  },

  // ---------------------------------------------------------------------------
  // Tool Capabilities (Analysis)
  // ---------------------------------------------------------------------------
  {
    id: "tool.check-consistency",
    kind: "tool",
    label: "Consistency",
    description: "Check for contradictions, plot holes, and timeline issues",
    icon: "AlertTriangle",
    category: "analysis",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["check", "consistency", "contradict", "plot", "hole", "timeline"],
    order: 80,
    toolName: "check_consistency",
    danger: "safe",
    requiresConfirmation: false,
    buildDefaultArgs: () => ({
      scope: "document",
    }),
  },
  {
    id: "tool.clarity-check",
    kind: "tool",
    label: "Clarity Check",
    description: "Find ambiguous pronouns, clichés, and readability issues",
    icon: "Eye",
    category: "analysis",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["clarity", "clear", "pronoun", "cliche", "filler", "readability"],
    order: 90,
    toolName: "clarity_check",
    danger: "safe",
    requiresConfirmation: false,
    buildDefaultArgs: () => ({
      scope: "document",
      maxIssues: 25,
    }),
  },
  {
    id: "tool.check-logic",
    kind: "tool",
    label: "Check Logic",
    description: "Validate magic rules, causality, and power scaling",
    icon: "Scale",
    category: "analysis",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["logic", "magic", "rules", "causality", "power", "scaling", "validate"],
    order: 95,
    toolName: "check_logic",
    danger: "safe",
    requiresConfirmation: false,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      scope: "document",
      strictness: ctx.preferences?.logicStrictness ?? "balanced",
    }),
  },
  {
    id: "tool.commit-decision",
    kind: "tool",
    label: "Commit Decision",
    description: "Record a canon decision in project memory",
    icon: "BookOpen",
    category: "analysis",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    requiresSelection: true,
    keywords: ["decision", "canon", "memory", "truth", "record"],
    order: 97,
    toolName: "commit_decision",
    danger: "safe",
    requiresConfirmation: true,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      decision: ctx.selectionText ?? "",
    }),
  },
  {
    id: "tool.name-generator",
    kind: "tool",
    label: "Generate Names",
    description: "Generate culturally-aware, genre-appropriate names",
    icon: "Wand2",
    category: "generation",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["name", "generate", "character", "culture", "genre"],
    order: 100,
    toolName: "name_generator",
    danger: "safe",
    requiresConfirmation: false,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      entityType: ctx.entityType ?? "character",
      genre: ctx.genre ?? ctx.preferences?.preferredGenre,
      culture: ctx.preferences?.namingCulture,
      style: ctx.preferences?.namingStyle ?? "standard",
      count: 10,
    }),
  },

  // ---------------------------------------------------------------------------
  // Knowledge Tools
  // ---------------------------------------------------------------------------
  {
    id: "tool.detect-entities",
    kind: "tool",
    label: "Extract Entities",
    description: "Extract entities from project documents",
    icon: "ScanSearch",
    category: "knowledge",
    surfaces: ["command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["detect", "entity", "extract", "graph", "relationship"],
    order: 110,
    toolName: "detect_entities",
    danger: "safe",
    requiresConfirmation: false,
    buildDefaultArgs: () => ({
      scope: "document",
      minConfidence: 0.7,
    }),
  },
  {
    id: "tool.genesis-world",
    kind: "tool",
    label: "Generate Project Scaffold",
    description: "Generate a project scaffold with starter entities and relationships",
    icon: "Globe",
    category: "knowledge",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["genesis", "project", "generate", "scaffold", "create"],
    order: 120,
    toolName: "genesis_world",
    danger: "safe",
    requiresConfirmation: true,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      genre: ctx.genre ?? ctx.preferences?.preferredGenre,
      detailLevel: "detailed",
      includeOutline: true,
    }),
  },

  // ---------------------------------------------------------------------------
  // Image Generation Capabilities
  // ---------------------------------------------------------------------------
  {
    id: "tool.generate-portrait",
    kind: "tool",
    label: "Generate Portrait",
    description: "Create an AI portrait for a character",
    icon: "User",
    category: "generation",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["portrait", "image", "generate", "character", "avatar", "art"],
    order: 200,
    toolName: "generate_image",
    danger: "costly",
    requiresConfirmation: true,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      entityType: "character",
      style: ctx.preferences?.preferredGenre === "manga" ? "anime" : "fantasy_art",
      aspectRatio: "3:4",
      assetType: "portrait",
    }),
  },
  {
    id: "tool.generate-landscape",
    kind: "tool",
    label: "Generate Landscape",
    description: "Create an AI landscape for a location",
    icon: "Mountain",
    category: "generation",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["landscape", "location", "scene", "environment", "image"],
    order: 210,
    toolName: "generate_image",
    danger: "costly",
    requiresConfirmation: true,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      entityType: "location",
      style: ctx.preferences?.preferredGenre === "manga" ? "anime" : "fantasy_art",
      aspectRatio: "16:9",
      assetType: "location",
    }),
  },
  {
    id: "tool.generate-item-icon",
    kind: "tool",
    label: "Generate Item",
    description: "Create an AI icon for an item or artifact",
    icon: "Gem",
    category: "generation",
    surfaces: ["command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["item", "icon", "weapon", "artifact", "generate"],
    order: 220,
    toolName: "generate_image",
    danger: "costly",
    requiresConfirmation: true,
    buildDefaultArgs: () => ({
      entityType: "item",
      style: "concept_art",
      aspectRatio: "1:1",
      assetType: "item",
    }),
  },
  {
    id: "tool.generate-scene",
    kind: "tool",
    label: "Illustrate Scene",
    description: "Generate an illustration for the current scene",
    icon: "Image",
    category: "generation",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    requiresSelection: true,
    keywords: ["scene", "illustration", "visualize", "image", "moment"],
    order: 230,
    toolName: "generate_image",
    danger: "costly",
    requiresConfirmation: true,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      entityType: "event",
      style: ctx.preferences?.preferredGenre === "manga" ? "manga" : "concept_art",
      aspectRatio: "16:9",
      assetType: "scene",
    }),
  },
  {
    id: "tool.edit-image",
    kind: "tool",
    label: "Edit Image",
    description: "Modify an existing asset (e.g., change hair color, add sunset background)",
    icon: "Paintbrush",
    category: "generation",
    surfaces: ["command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["edit", "image", "remix", "refine", "variation", "portrait", "scene", "modify"],
    order: 240,
    toolName: "edit_image",
    danger: "costly",
    requiresConfirmation: true,
    buildDefaultArgs: () => ({
      editMode: "remix",
      preserveAspectRatio: true,
      setAsPortrait: true,
    }),
  },
];

const CAPABILITIES_WIDGETS: WidgetCapability[] = [
  {
    id: "widget.summarize",
    kind: "widget",
    label: "Summarize",
    description: "Condense the selected text",
    icon: "FileText",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresSelection: true,
    requiresProject: true,
    widgetType: "inline",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 1,
    prompt: {
      system: "You are a concise summarizer.",
      user: "Summarize the following text:\n\n{{selection}}",
      variables: [
        { name: "selection", type: "selection", required: true },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 20,
  },
  {
    id: "widget.expand",
    kind: "widget",
    label: "Expand",
    description: "Expand the selected text with more detail",
    icon: "Maximize2",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresSelection: true,
    requiresProject: true,
    widgetType: "inline",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 2,
    prompt: {
      system: "You expand text while keeping the original intent and style.",
      user: "Expand the following text with more detail:\n\n{{selection}}",
      variables: [
        { name: "selection", type: "selection", required: true },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 30,
  },
  {
    id: "widget.rewrite",
    kind: "widget",
    label: "Rewrite",
    description: "Rewrite the selected text in a new tone",
    icon: "RefreshCw",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresSelection: true,
    requiresProject: true,
    widgetType: "inline",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 2,
    parameters: [
      { name: "tone", type: "enum", options: ["formal", "casual", "concise", "expanded"], default: "formal" },
    ],
    prompt: {
      system: "You rewrite text while preserving the original meaning.",
      user: "Rewrite the following text in a {{tone}} tone:\n\n{{selection}}",
      variables: [
        { name: "tone", type: "string", required: true },
        { name: "selection", type: "selection", required: true },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 40,
  },
  {
    id: "widget.outline",
    kind: "widget",
    label: "Outline",
    description: "Turn the selection into a structured outline",
    icon: "List",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresSelection: true,
    requiresProject: true,
    widgetType: "inline",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 2,
    prompt: {
      system: "You create clear markdown outlines using ## headings.",
      user: "Create a structured outline for the following text using markdown headings:\n\n{{selection}}",
      variables: [
        { name: "selection", type: "selection", required: true },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 50,
  },
  {
    id: "widget.generate-name",
    kind: "widget",
    label: "Generate Names",
    description: "Suggest names based on the current context",
    icon: "Sparkles",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresProject: true,
    widgetType: "inline",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 1,
    prompt: {
      system: "You generate concise name suggestions.",
      user: "Suggest 8 names based on this context:\n\n{{selection}}",
      variables: [
        { name: "selection", type: "selection", required: false },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 60,
  },
  {
    id: "widget.ask-ai",
    kind: "widget",
    label: "Ask AI",
    description: "Answer the prompt with project context",
    icon: "Sparkles",
    category: "generation",
    surfaces: ["command_palette"],
    requiresProject: true,
    widgetType: "inline",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 1,
    prompt: {
      system: "You are a helpful co-author responding to the user's prompt.",
      user: "Prompt: {{prompt}}\n\nSelection:\n{{selection}}",
      variables: [
        { name: "prompt", type: "string", required: true },
        { name: "selection", type: "selection", required: false },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    order: 70,
  },
  {
    id: "widget.create-spec",
    kind: "widget",
    label: "Create Spec",
    description: "Generate a specification document",
    icon: "FileCode",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresProject: true,
    widgetType: "artifact",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: true,
    costWeight: 5,
    prompt: {
      system: "You draft clear, concise specification documents.",
      user: "Create a specification based on the current document context:\n\n{{document}}",
      variables: [
        { name: "document", type: "document", required: false },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    order: 100,
  },
  {
    id: "widget.create-summary",
    kind: "widget",
    label: "Create Summary",
    description: "Generate a summary document",
    icon: "FileText",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresProject: true,
    widgetType: "artifact",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 3,
    prompt: {
      system: "You draft clear, concise summaries.",
      user: "Summarize the current document context:\n\n{{document}}",
      variables: [
        { name: "document", type: "document", required: false },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    order: 110,
  },
  {
    id: "widget.create-brief",
    kind: "widget",
    label: "Create Brief",
    description: "Generate a project brief",
    icon: "FileText",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresProject: true,
    widgetType: "artifact",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 4,
    prompt: {
      system: "You draft tight creative briefs.",
      user: "Create a brief based on the current document context:\n\n{{document}}",
      variables: [
        { name: "document", type: "document", required: false },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    order: 120,
  },
  {
    id: "widget.create-notes",
    kind: "widget",
    label: "Create Notes",
    description: "Generate structured notes",
    icon: "FileText",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresProject: true,
    widgetType: "artifact",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 3,
    prompt: {
      system: "You turn raw context into clear notes.",
      user: "Generate notes from the current document context:\n\n{{document}}",
      variables: [
        { name: "document", type: "document", required: false },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    order: 130,
  },
  {
    id: "widget.create-release-notes",
    kind: "widget",
    label: "Create Release Notes",
    description: "Generate release notes",
    icon: "FileText",
    category: "generation",
    surfaces: ["slash_menu", "command_palette"],
    requiresProject: true,
    widgetType: "artifact",
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    costWeight: 4,
    prompt: {
      system: "You write concise release notes.",
      user: "Create release notes from the current document context:\n\n{{document}}",
      variables: [
        { name: "document", type: "document", required: false },
      ],
    },
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    order: 140,
  },
];

const CAPABILITIES_WRITER: Capability[] = [];
const CAPABILITIES_PRODUCT: Capability[] = [];
const CAPABILITIES_ENGINEERING: Capability[] = [];
const CAPABILITIES_DESIGN: Capability[] = [];
const CAPABILITIES_COMMS: Capability[] = [];

export const CAPABILITIES: Capability[] = [
  ...CAPABILITIES_BASE,
  ...CAPABILITIES_WIDGETS,
  ...CAPABILITIES_WRITER,
];

export function getCapabilitiesForTemplate(
  templateId: ProjectTemplateId
): Capability[] {
  switch (templateId) {
    case "product":
      return [...CAPABILITIES_BASE, ...CAPABILITIES_WIDGETS, ...CAPABILITIES_PRODUCT];
    case "engineering":
      return [...CAPABILITIES_BASE, ...CAPABILITIES_WIDGETS, ...CAPABILITIES_ENGINEERING];
    case "design":
      return [...CAPABILITIES_BASE, ...CAPABILITIES_WIDGETS, ...CAPABILITIES_DESIGN];
    case "comms":
      return [...CAPABILITIES_BASE, ...CAPABILITIES_WIDGETS, ...CAPABILITIES_COMMS];
    case "custom":
      return [...CAPABILITIES_BASE, ...CAPABILITIES_WIDGETS];
    case "writer":
    default:
      return [...CAPABILITIES_BASE, ...CAPABILITIES_WIDGETS, ...CAPABILITIES_WRITER];
  }
}

// =============================================================================
// Registry Helpers
// =============================================================================

/**
 * Get capabilities for a specific surface.
 */
export function getCapabilitiesForSurface(surface: CapabilitySurface): Capability[] {
  return CAPABILITIES
    .filter((cap) => cap.surfaces.includes(surface))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Get a capability by ID.
 */
export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((cap) => cap.id === id);
}

/**
 * Get all tool capabilities.
 */
export function getToolCapabilities(): ToolCapability[] {
  return CAPABILITIES.filter((cap): cap is ToolCapability => cap.kind === "tool");
}

/**
 * Get capabilities by category.
 */
export function getCapabilitiesByCategory(category: string): Capability[] {
  return CAPABILITIES
    .filter((cap) => cap.category === category)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Search capabilities by query string.
 */
export function searchCapabilities(query: string): Capability[] {
  const lowerQuery = query.toLowerCase();
  return CAPABILITIES.filter((cap) => {
    const searchableText = [
      cap.id,
      cap.label,
      cap.description,
      ...(cap.keywords ?? []),
    ].join(" ").toLowerCase();
    return searchableText.includes(lowerQuery);
  });
}
