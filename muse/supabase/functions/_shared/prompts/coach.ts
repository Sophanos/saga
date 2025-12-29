/**
 * Writing Coach Prompts
 *
 * Re-exports prompts from @mythos/prompts package.
 * Used by the ai-coach edge function.
 */

export {
  WRITING_COACH_SYSTEM,
  GENRE_COACH_CONTEXTS,
  QUICK_COACH_PROMPT,
  SENSORY_FOCUS_PROMPT,
  TENSION_FOCUS_PROMPT,
} from "../../../../packages/prompts/src/coach.ts";
