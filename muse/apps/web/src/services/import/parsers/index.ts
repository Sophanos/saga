import type { ImportFormat } from "../types";
import type { ExportBlock } from "../../export/ir";

// ============================================================================
// Parser Exports
// ============================================================================

export { parseMarkdown, htmlToBlocks } from "./markdown";
export { parseDocx } from "./docx";
export { parseEpub } from "./epub";
export { parsePlaintext } from "./plaintext";

// ============================================================================
// Parser Types
// ============================================================================

export type TextParserFn = (input: string) => Promise<ExportBlock[]> | ExportBlock[];
export type BinaryParserFn = (input: ArrayBuffer) => Promise<ExportBlock[]>;

// ============================================================================
// Format to Parser Routing
// ============================================================================

/**
 * Get the appropriate parser for a format.
 * Uses dynamic imports to keep initial bundle size small.
 *
 * Note: Caller must ensure correct input type based on formatRequiresBinary()
 */
export async function getParserForFormat(format: ImportFormat): Promise<TextParserFn | BinaryParserFn> {
  switch (format) {
    case "markdown": {
      const { parseMarkdown } = await import("./markdown");
      return parseMarkdown;
    }
    case "docx": {
      const { parseDocx } = await import("./docx");
      return parseDocx;
    }
    case "epub": {
      const { parseEpub } = await import("./epub");
      return parseEpub;
    }
    case "plaintext": {
      const { parsePlaintext } = await import("./plaintext");
      return (input: string) => parsePlaintext(input);
    }
  }
}

/**
 * Check if format requires binary (ArrayBuffer) input
 */
export function formatRequiresBinary(format: ImportFormat): boolean {
  return format === "docx" || format === "epub";
}
