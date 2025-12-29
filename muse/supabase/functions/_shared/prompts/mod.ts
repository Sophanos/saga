/**
 * Shared Prompts for Supabase Edge Functions
 *
 * Re-exports all AI prompts from @mythos/prompts package.
 * Import from here instead of defining prompts inline.
 */

// Coach prompts
export {
  WRITING_COACH_SYSTEM,
  GENRE_COACH_CONTEXTS,
  QUICK_COACH_PROMPT,
  SENSORY_FOCUS_PROMPT,
  TENSION_FOCUS_PROMPT,
} from "./coach.ts";

// Dynamics prompts
export {
  DYNAMICS_EXTRACTOR_SYSTEM,
  DYNAMICS_QUICK_PROMPT,
  DYNAMICS_HOSTILE_FOCUS_PROMPT,
  DYNAMICS_HIDDEN_FOCUS_PROMPT,
} from "./dynamics.ts";

// Linter prompts
export {
  CONSISTENCY_LINTER_SYSTEM,
  ARCHETYPE_LINTER_SYSTEM,
  PACING_ANALYZER_SYSTEM,
} from "./linter.ts";

// Entity detector prompts
export {
  ENTITY_DETECTOR_SYSTEM,
  ENTITY_DETECTOR_USER_TEMPLATE,
} from "./entity-detector.ts";

// Chat prompts
export {
  CHAT_SYSTEM,
  CHAT_CONTEXT_TEMPLATE,
  CHAT_NO_CONTEXT,
  CHAT_MENTION_CONTEXT,
} from "./chat.ts";
