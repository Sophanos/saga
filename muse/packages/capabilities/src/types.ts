/**
 * @mythos/capabilities
 *
 * Central capability registry types.
 * Capabilities are environment-agnostic feature descriptors that can be surfaced as:
 * - Sidebar Quick Actions
 * - Command Palette commands (Cmd+K)
 * - Chat/Agent tool availability + invocation metadata
 */

import type {
  ToolName,
  ToolDangerLevel,
  ToolArgsMap,
  WritingPreferences,
  EntityType,
} from "@mythos/agent-protocol";

// =============================================================================
// Surfaces & Kinds
// =============================================================================

/**
 * Where a capability can be surfaced in the UI.
 */
export type CapabilitySurface = "quick_actions" | "command_palette" | "chat";

/**
 * The kind of action a capability represents.
 */
export type CapabilityKind = "tool" | "chat_prompt" | "ui";

/**
 * Category for organizing capabilities.
 */
export type CapabilityCategory =
  | "analysis"
  | "generation"
  | "knowledge"
  | "navigation";

// =============================================================================
// Context
// =============================================================================

/**
 * Context available when building capability prompts or default args.
 */
export interface CapabilityContext {
  /** Whether a project is currently loaded */
  hasProject?: boolean;
  /** Currently selected text in the editor */
  selectionText?: string;
  /** Title of the current document */
  documentTitle?: string;
  /** Genre of the current project */
  genre?: string;
  /** User's writing preferences */
  preferences?: WritingPreferences;
  /** Entity type context (for entity forms) */
  entityType?: EntityType;
}

// =============================================================================
// UI Actions
// =============================================================================

/**
 * Types of UI actions that capabilities can trigger.
 */
export type UIAction =
  | { type: "open_console_tab"; tab: "chat" | "linter" | "search" | "dynamics" | "coach" }
  | { type: "open_modal"; modal: "profile" | "settings" | "entity_form"; payload?: unknown };

// =============================================================================
// Capability Interfaces
// =============================================================================

/**
 * Base properties shared by all capabilities.
 */
interface CapabilityBase {
  /** Stable capability ID */
  id: string;
  /** Display label */
  label: string;
  /** Longer description */
  description: string;
  /** Category for grouping */
  category: CapabilityCategory;
  /** Lucide icon name (as string, no React dependency) */
  icon: string;
  /** Where this capability should appear */
  surfaces: CapabilitySurface[];
  /** Requires selected text in editor */
  requiresSelection?: boolean;
  /** Requires a project to be loaded */
  requiresProject?: boolean;
  /** Requires user's API key (BYOK) */
  requiresApiKey?: boolean;
  /** Search keywords for command palette */
  keywords?: string[];
  /** Keyboard shortcut (for command palette) */
  shortcut?: string;
  /** Display order (lower = higher priority) */
  order?: number;
}

/**
 * A capability that invokes an AI tool.
 */
export interface ToolCapability<T extends ToolName = ToolName> extends CapabilityBase {
  kind: "tool";
  /** The tool to invoke */
  toolName: T;
  /** Danger level of the tool */
  danger: ToolDangerLevel;
  /** Whether the tool requires user confirmation */
  requiresConfirmation: boolean;
  /** Build default args from context */
  buildDefaultArgs?: (ctx: CapabilityContext) => Partial<ToolArgsMap[T]>;
}

/**
 * A capability that sends a prompt to the chat.
 */
export interface PromptCapability extends CapabilityBase {
  kind: "chat_prompt";
  /** Build the prompt from context */
  buildPrompt: (ctx: CapabilityContext) => string;
}

/**
 * A capability that performs a UI action.
 */
export interface UIActionCapability extends CapabilityBase {
  kind: "ui";
  /** The UI action to perform */
  action: UIAction;
}

/**
 * Union of all capability types.
 */
export type Capability = ToolCapability | PromptCapability | UIActionCapability;

// =============================================================================
// Type Guards
// =============================================================================

export function isToolCapability(cap: Capability): cap is ToolCapability {
  return cap.kind === "tool";
}

export function isPromptCapability(cap: Capability): cap is PromptCapability {
  return cap.kind === "chat_prompt";
}

export function isUIActionCapability(cap: Capability): cap is UIActionCapability {
  return cap.kind === "ui";
}
