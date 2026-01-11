/**
 * @mythos/capabilities
 *
 * Central capability registry for AI features.
 * Single source of truth for Quick Actions, Command Palette, and Chat tools.
 */

// Types
export type {
  CapabilitySurface,
  CapabilityKind,
  CapabilityCategory,
  CapabilityContext,
  UIAction,
  ToolCapability,
  PromptCapability,
  UIActionCapability,
  WidgetCapability,
  WidgetType,
  StructuredPrompt,
  PromptVariable,
  PromptVariableType,
  WidgetParam,
  Capability,
} from "./types";

export {
  isToolCapability,
  isPromptCapability,
  isUIActionCapability,
  isWidgetCapability,
} from "./types";

// Registry
export {
  CAPABILITIES,
  getCapabilitiesForSurface,
  getCapability,
  getToolCapabilities,
  getCapabilitiesByCategory,
  searchCapabilities,
} from "./registry";

// Icons
export {
  CAPABILITY_ICON_MAP,
  getCapabilityIcon,
  type LucideIcon,
} from "./icons";

// Re-export preferences from agent-protocol for convenience
export type {
  WritingPreferences,
  ProfilePreferences,
} from "@mythos/agent-protocol";
