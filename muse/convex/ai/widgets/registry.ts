export interface ServerWidgetDef {
  id: string;
  version: string;
  widgetType: "inline" | "artifact";
  artifactType?: string;
  defaultModel: string;
  costWeight: number;
  contextBudget: "adaptive" | number;
  clarifyOnAmbiguity: boolean;
  requiresSelection: boolean;
  requiresProject: boolean;
  prompt: { system: string; user: string };
  outputSchemaId?: string;
}

const WIDGET_DEFS: Record<string, ServerWidgetDef> = {
  "widget.summarize": {
    id: "widget.summarize",
    version: "1",
    widgetType: "inline",
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    costWeight: 1,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: true,
    requiresProject: true,
    prompt: {
      system: "You are a concise summarizer.",
      user: "Summarize the following text:\n\n{{selection}}",
    },
  },
  "widget.expand": {
    id: "widget.expand",
    version: "1",
    widgetType: "inline",
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    costWeight: 2,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: true,
    requiresProject: true,
    prompt: {
      system: "You expand text while keeping the original intent and style.",
      user: "Expand the following text with more detail:\n\n{{selection}}",
    },
  },
  "widget.rewrite": {
    id: "widget.rewrite",
    version: "1",
    widgetType: "inline",
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    costWeight: 2,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: true,
    requiresProject: true,
    prompt: {
      system: "You rewrite text while preserving the original meaning.",
      user: "Rewrite the following text in a {{tone}} tone:\n\n{{selection}}",
    },
  },
  "widget.outline": {
    id: "widget.outline",
    version: "1",
    widgetType: "inline",
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    costWeight: 2,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: true,
    requiresProject: true,
    prompt: {
      system: "You create clear markdown outlines using ## headings.",
      user: "Create a structured outline for the following text using markdown headings:\n\n{{selection}}",
    },
  },
  "widget.generate-name": {
    id: "widget.generate-name",
    version: "1",
    widgetType: "inline",
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    costWeight: 1,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You generate concise name suggestions.",
      user: "Suggest 8 names based on this context:\n\n{{selection}}",
    },
  },
  "widget.ask-ai": {
    id: "widget.ask-ai",
    version: "1",
    widgetType: "inline",
    defaultModel: "openrouter/anthropic/claude-3-haiku",
    costWeight: 1,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You are a helpful co-author responding to the user's prompt.",
      user: "Prompt: {{prompt}}\n\nSelection:\n{{selection}}",
    },
  },
  "widget.create-spec": {
    id: "widget.create-spec",
    version: "1",
    widgetType: "artifact",
    artifactType: "spec",
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    costWeight: 5,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: true,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You draft clear, concise specification documents.",
      user: "Create a specification based on the current document context:\n\n{{document}}",
    },
  },
  "widget.create-summary": {
    id: "widget.create-summary",
    version: "1",
    widgetType: "artifact",
    artifactType: "summary",
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    costWeight: 3,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You draft clear, concise summaries.",
      user: "Summarize the current document context:\n\n{{document}}",
    },
  },
  "widget.create-brief": {
    id: "widget.create-brief",
    version: "1",
    widgetType: "artifact",
    artifactType: "brief",
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    costWeight: 4,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You draft tight creative briefs.",
      user: "Create a brief based on the current document context:\n\n{{document}}",
    },
  },
  "widget.create-notes": {
    id: "widget.create-notes",
    version: "1",
    widgetType: "artifact",
    artifactType: "notes",
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    costWeight: 3,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You turn raw context into clear notes.",
      user: "Generate notes from the current document context:\n\n{{document}}",
    },
  },
  "widget.create-release-notes": {
    id: "widget.create-release-notes",
    version: "1",
    widgetType: "artifact",
    artifactType: "release-notes",
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    costWeight: 4,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You write concise release notes.",
      user: "Create release notes from the current document context:\n\n{{document}}",
    },
  },
  "widget.fetch": {
    id: "widget.fetch",
    version: "1",
    widgetType: "artifact",
    artifactType: "web",
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    costWeight: 2,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You fetch external content and return the raw text with a short title.",
      user: "Fetch the following source and return the content:\n\n{{source}}",
    },
  },
  "widget.diagram": {
    id: "widget.diagram",
    version: "1",
    widgetType: "artifact",
    artifactType: "diagram",
    defaultModel: "openrouter/anthropic/claude-3-5-sonnet",
    costWeight: 3,
    contextBudget: "adaptive",
    clarifyOnAmbiguity: false,
    requiresSelection: false,
    requiresProject: true,
    prompt: {
      system: "You generate mermaid diagrams that are easy to read.",
      user: "Create a {{diagramType}} diagram based on the current context:\n\n{{document}}\n\nSelection:\n{{selection}}",
    },
  },
};

export function getServerWidgetDef(widgetId: string): ServerWidgetDef {
  const def = WIDGET_DEFS[widgetId];
  if (!def) {
    throw new Error(`Unknown widget: ${widgetId}`);
  }
  return def;
}
