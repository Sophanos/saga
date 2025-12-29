/**
 * @mythos/prompts
 *
 * Centralized AI prompts for Mythos IDE.
 * This package contains all system prompts used by AI agents
 * for consistent behavior across the application.
 */

// Coach prompts
export {
  WRITING_COACH_SYSTEM,
  GENRE_COACH_CONTEXTS,
  QUICK_COACH_PROMPT,
  SENSORY_FOCUS_PROMPT,
  TENSION_FOCUS_PROMPT,
} from "./coach";

// Dynamics prompts
export {
  DYNAMICS_EXTRACTOR_SYSTEM,
  DYNAMICS_QUICK_PROMPT,
  DYNAMICS_HOSTILE_FOCUS_PROMPT,
  DYNAMICS_HIDDEN_FOCUS_PROMPT,
} from "./dynamics";

// Entity detector prompts
export {
  ENTITY_DETECTOR_SYSTEM,
  ENTITY_DETECTOR_USER_TEMPLATE,
} from "./entity-detector";

// Linter prompts
export {
  CONSISTENCY_LINTER_SYSTEM,
  ARCHETYPE_LINTER_SYSTEM,
  PACING_ANALYZER_SYSTEM,
} from "./linter";

// Genesis prompts
export {
  GENESIS_SYSTEM,
  STYLE_GUIDE_SYSTEM,
} from "./genesis";

// Clarity prompts
export {
  CLARITY_CHECK_SYSTEM,
  QUICK_CLARITY_PROMPT,
} from "./clarity";

// Logic check prompts
export {
  LOGIC_CHECK_SYSTEM,
  LOGIC_CHECK_PROMPT,
} from "./logic";

// Name generator prompts
export {
  NAME_GENERATOR_SYSTEM,
  NAME_GENERATOR_PROMPT,
} from "./names";
