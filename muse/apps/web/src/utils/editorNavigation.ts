/**
 * Editor navigation utilities
 * Shared helpers for jumping to positions and applying fixes in the editor
 */

/**
 * Find the character position in a document for a given line number and optional target text
 *
 * @param content - The full document content
 * @param lineNumber - 1-based line number to navigate to
 * @param targetText - Optional text to find within the line for precise positioning
 * @returns Character position (0-based) in the document
 */
export function findPositionForLine(
  content: string,
  lineNumber: number,
  targetText?: string
): number {
  const lines = content.split("\n");
  let position = 0;

  // Calculate position at start of target line
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    position += lines[i].length + 1; // +1 for newline
  }

  // Try to find the target text within the line for more precise positioning
  if (targetText && lineNumber <= lines.length) {
    const line = lines[lineNumber - 1];
    const textIndex = line.indexOf(targetText);
    if (textIndex !== -1) {
      position += textIndex;
    }
  }

  return position;
}

/**
 * Text location interface used by both linter and coach issues
 */
export interface TextLocation {
  /** 1-based line number */
  line: number;
  /** Text excerpt at the location */
  text: string;
}

/**
 * Fix suggestion with old and new text for replacement
 */
export interface TextFix {
  /** Original text to replace */
  oldText: string;
  /** New text to insert */
  newText: string;
}
