/**
 * Progressive disclosure components
 *
 * These components manage the gardener mode experience:
 * - Gradual feature revelation based on writing progress
 * - Subtle nudges for entity tracking and consistency
 * - Feature unlock suggestions based on usage patterns
 */

export { ProgressiveNudge } from "./ProgressiveNudge";
export type { ProgressiveNudgeProps } from "./ProgressiveNudge";

export { ProgressiveStructureController } from "./ProgressiveStructureController";
export type { ProgressiveStructureControllerProps } from "./ProgressiveStructureController";

// Paste event emitter for inter-component communication
export { emitPaste, setPasteHandler, hasPasteHandler } from "./pasteEvents";
export type { PasteHandler } from "./pasteEvents";
