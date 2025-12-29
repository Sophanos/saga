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
  Capability,
} from "./types";

export {
  isToolCapability,
  isPromptCapability,
  isUIActionCapability,
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

// Re-export preferences from agent-protocol for convenience
export type {
  WritingPreferences,
  ProfilePreferences,
} from "@mythos/agent-protocol";
