/**
 * @mythos/context
 *
 * Client-side context assembly for Mythos IDE.
 * Provides utilities for building and formatting context hints.
 */

// Types
export * from "./types";

// Builders
export {
  buildProfileContext,
  buildWorldContext,
  buildProjectPersonalizationContext,
  buildContextHints,
} from "./builders";

// Formatters
export {
  formatProfileContext,
  formatWorldContext,
  formatContextHints,
  isContextHintsEmpty,
} from "./formatters";
