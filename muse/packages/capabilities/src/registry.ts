/**
 * Central capability registry.
 *
 * All AI capabilities are defined here as the single source of truth.
 * QuickActions, Command Palette, and Chat UI all derive from this registry.
 */

import type { Capability, CapabilitySurface, ToolCapability, CapabilityContext } from "./types";

// =============================================================================
// Capability Registry
// =============================================================================

export const CAPABILITIES: Capability[] = [
  // ---------------------------------------------------------------------------
  // UI Actions (Navigation)
  // ---------------------------------------------------------------------------
  {
    id: "ai.chat",
    kind: "ui",
    label: "Ask AI",
    description: "Open AI chat to ask questions about your story",
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
    label: "Writing Coach",
    description: "Get AI feedback on pacing, show-don't-tell, and more",
    icon: "Brain",
    category: "analysis",
    surfaces: ["command_palette"],
    requiresProject: true,
    keywords: ["analyze", "style", "coach", "feedback", "pacing", "writing"],
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
    description: "Manage your profile and writing preferences",
    icon: "User",
    category: "navigation",
    surfaces: ["command_palette"],
    keywords: ["profile", "settings", "preferences", "genre", "culture"],
    order: 100,
    action: { type: "open_modal", modal: "profile" },
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
    label: "Detect Entities",
    description: "Detect characters, locations, and items in the document",
    icon: "ScanSearch",
    category: "worldbuilding",
    surfaces: ["quick_actions", "command_palette"],
    requiresProject: true,
    keywords: ["detect", "entity", "extract", "selection", "ai"],
    order: 20,
    buildPrompt: () =>
      "Analyze the current document and detect all characters, locations, items, and other story elements that should be tracked as entities.",
  },
  {
    id: "prompt.create-character",
    kind: "chat_prompt",
    label: "Create Character",
    description: "Help create a new character based on story context",
    icon: "User",
    category: "worldbuilding",
    surfaces: ["quick_actions"],
    requiresProject: true,
    order: 30,
    buildPrompt: () =>
      "Help me create a new character based on the current story context. Ask me about their role, personality, and appearance.",
  },
  {
    id: "prompt.relationships",
    kind: "chat_prompt",
    label: "Relationships",
    description: "Suggest potential relationships between entities",
    icon: "GitBranch",
    category: "worldbuilding",
    surfaces: ["quick_actions"],
    requiresProject: true,
    order: 40,
    buildPrompt: () =>
      "Analyze the entities in my story and suggest potential relationships between them. Consider family ties, alliances, rivalries, and romantic connections.",
  },
  {
    id: "prompt.backstory",
    kind: "chat_prompt",
    label: "Backstory",
    description: "Generate a backstory for the selected element",
    icon: "BookOpen",
    category: "generation",
    surfaces: ["quick_actions"],
    requiresSelection: true,
    requiresProject: true,
    order: 50,
    buildPrompt: () =>
      "Generate a compelling backstory for the character or element in the selected text.",
  },
  {
    id: "prompt.build-world",
    kind: "chat_prompt",
    label: "Build World",
    description: "Generate entities, relationships, and story structure",
    icon: "LayoutTemplate",
    category: "worldbuilding",
    surfaces: ["quick_actions"],
    requiresProject: true,
    order: 60,
    buildPrompt: () =>
      "Help me expand my story world. Generate entities, relationships, and story structure based on what I've written so far.",
  },
  {
    id: "prompt.next-steps",
    kind: "chat_prompt",
    label: "Next Steps",
    description: "Suggest possible directions for the story",
    icon: "Lightbulb",
    category: "generation",
    surfaces: ["quick_actions"],
    requiresProject: true,
    order: 70,
    buildPrompt: () =>
      "Based on the current story, suggest 3-5 possible directions for what could happen next. Consider character arcs, plot tension, and thematic elements.",
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
  // Worldbuilding Tools
  // ---------------------------------------------------------------------------
  {
    id: "tool.detect-entities",
    kind: "tool",
    label: "Detect Entities",
    description: "Extract entities from narrative text",
    icon: "ScanSearch",
    category: "worldbuilding",
    surfaces: ["command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["detect", "entity", "extract", "character", "location"],
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
    label: "Genesis World",
    description: "Generate a complete world scaffold from a description",
    icon: "Globe",
    category: "worldbuilding",
    surfaces: ["command_palette"],
    requiresProject: true,
    requiresApiKey: true,
    keywords: ["genesis", "world", "generate", "scaffold", "create"],
    order: 120,
    toolName: "genesis_world",
    danger: "safe",
    requiresConfirmation: true,
    buildDefaultArgs: (ctx: CapabilityContext) => ({
      genre: ctx.genre ?? ctx.preferences?.preferredGenre,
      detailLevel: "standard",
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
];

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
