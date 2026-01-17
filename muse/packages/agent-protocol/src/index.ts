/**
 * @mythos/agent-protocol
 *
 * Shared types and contracts for the AI agent tool system.
 * Used by both server (Edge Functions) and client (Web/Mobile).
 */

// =============================================================================
// Barrel Exports
// =============================================================================

// Core domain types, re-exports from @mythos/core, enums
export * from "./types";

// Tool definitions, invocation types, arguments, and results
export * from "./tools";

// Evidence selector utilities
export * from "./evidenceSelectors";

// SSE stream events for agent responses
export * from "./events";

// Memory system (MLP 1.5) types
export * from "./memory";

// Widget execution contract
export * from "./widgets";
