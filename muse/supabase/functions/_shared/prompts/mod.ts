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

// Agent prompts (with tool calling)
export {
  AGENT_SYSTEM,
  AGENT_CONTEXT_TEMPLATE,
  AGENT_EDITOR_CONTEXT,
} from "./agent.ts";

// Genesis wizard prompts (world generation)
export {
  GENESIS_SYSTEM_PROMPT,
  GENESIS_USER_TEMPLATE,
  buildGenesisUserPrompt,
} from "./genesis.ts";

// Saga unified agent prompts
export {
  SAGA_SYSTEM,
  SAGA_CONTEXT_TEMPLATE,
  SAGA_EDITOR_CONTEXT,
  SAGA_NO_CONTEXT,
  SAGA_MODE_ADDENDUMS,
  buildSagaSystemPrompt,
} from "./saga.ts";

// Clarity check prompts
export {
  CLARITY_CHECK_SYSTEM,
  QUICK_CLARITY_PROMPT,
} from "./clarity.ts";

// Logic check prompts
export {
  LOGIC_CHECK_SYSTEM,
  LOGIC_CHECK_PROMPT,
} from "./logic.ts";

// Name generator prompts
export {
  NAME_GENERATOR_SYSTEM,
  NAME_GENERATOR_PROMPT,
} from "./names.ts";
