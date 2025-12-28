/**
 * Shared Prompts for Supabase Edge Functions
 *
 * This module exports all AI prompts used by edge functions.
 * Import from here instead of defining prompts inline.
 */

export { WRITING_COACH_SYSTEM } from "./coach.ts";
export { DYNAMICS_EXTRACTOR_SYSTEM } from "./dynamics.ts";
export { CONSISTENCY_LINTER_SYSTEM } from "./linter.ts";
export { ENTITY_DETECTOR_SYSTEM } from "./entity-detector.ts";
