/**
 * Paste Event Emitter
 *
 * Provides a clean event-based pattern for inter-component communication
 * around substantial paste detection, replacing fragile window globals.
 *
 * Usage:
 * - Producer (ProgressiveStructureController): Registers handler via setPasteHandler
 * - Consumer (Editor/Canvas): Calls emitPaste when substantial paste is detected
 */

// Type for the paste handler function
export type PasteHandler = (text: string, position: number) => void;

// Internal state for the paste handler
let currentHandler: PasteHandler | null = null;

/**
 * Set the paste handler. Only one handler can be active at a time.
 * Returns an unsubscribe function for cleanup.
 */
export function setPasteHandler(handler: PasteHandler): () => void {
  currentHandler = handler;

  return () => {
    // Only clear if we're still the current handler
    if (currentHandler === handler) {
      currentHandler = null;
    }
  };
}

/**
 * Emit a paste event. If no handler is registered, this is a no-op.
 */
export function emitPaste(text: string, position: number): void {
  currentHandler?.(text, position);
}

/**
 * Check if a paste handler is currently registered.
 * Useful for debugging or conditional logic.
 */
export function hasPasteHandler(): boolean {
  return currentHandler !== null;
}
