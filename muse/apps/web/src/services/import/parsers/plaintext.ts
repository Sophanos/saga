import type { ExportBlock, ExportInline } from "../../export/ir";

// ============================================================================
// Plain Text Parser
// ============================================================================

/**
 * Parse plain text into IR blocks.
 * 
 * Strategy:
 * - Split by blank lines into paragraphs
 * - Normalize line endings
 * - Preserve internal line breaks as hard breaks
 */
export function parsePlaintext(text: string): ExportBlock[] {
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split by blank lines (two or more newlines)
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return [];
  }

  const blocks: ExportBlock[] = [];

  for (const para of paragraphs) {
    // Check if this looks like a heading (single short line, possibly with markers)
    const lines = para.split("\n");
    
    if (lines.length === 1 && isLikelyHeading(para)) {
      const { level, text: headingText } = extractHeading(para);
      blocks.push({
        kind: "heading",
        level,
        inlines: [{ kind: "text", text: headingText }],
      });
    } else {
      // Regular paragraph - preserve internal line breaks
      const inlines = linesToInlines(lines);
      if (inlines.length > 0) {
        blocks.push({
          kind: "paragraph",
          inlines,
        });
      }
    }
  }

  return blocks;
}

/**
 * Check if a line looks like a heading
 */
function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  
  // Check for common heading patterns
  // 1. "Chapter X" or "CHAPTER X"
  if (/^(chapter|part|prologue|epilogue|introduction|conclusion)\s*/i.test(trimmed)) {
    return true;
  }
  
  // 2. All caps and short
  if (trimmed.length <= 50 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return true;
  }
  
  // 3. Numbered heading like "1." or "I."
  if (/^[IVXivx]+\.\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Extract heading level and clean text
 */
function extractHeading(line: string): { level: 1 | 2; text: string } {
  const trimmed = line.trim();
  
  // "Chapter" or "Part" -> H1
  if (/^(chapter|part)\s*/i.test(trimmed)) {
    return { level: 1, text: trimmed };
  }
  
  // Everything else -> H2
  return { level: 2, text: trimmed };
}

/**
 * Convert lines to inline elements, preserving line breaks
 */
function linesToInlines(lines: string[]): ExportInline[] {
  const inlines: ExportInline[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.length > 0) {
      inlines.push({ kind: "text", text: line });
    }
    
    // Add hard break between lines (except after last)
    if (i < lines.length - 1) {
      inlines.push({ kind: "hardBreak" });
    }
  }

  return inlines;
}
