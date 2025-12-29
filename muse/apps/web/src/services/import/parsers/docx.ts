import type { ExportBlock } from "../../export/ir";
import { htmlToBlocks } from "./markdown";

// ============================================================================
// DOCX Parser
// ============================================================================

/**
 * Parse DOCX file into IR blocks.
 * 
 * Strategy:
 * - Use 'mammoth' to convert DOCX to HTML
 * - Reuse HTML-to-IR conversion from markdown parser
 */
export async function parseDocx(buffer: ArrayBuffer): Promise<ExportBlock[]> {
  // Dynamic import to reduce bundle size
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = (await import("mammoth")) as any;

  // Style map to preserve heading levels
  const styleMap = [
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Heading 4'] => h4:fresh",
    "p[style-name='Heading 5'] => h5:fresh",
    "p[style-name='Heading 6'] => h6:fresh",
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Subtitle'] => h2:fresh",
    // Preserve block quotes
    "p[style-name='Quote'] => blockquote > p:fresh",
    "p[style-name='Block Quote'] => blockquote > p:fresh",
    // Preserve code blocks
    "p[style-name='Code'] => pre > code:fresh",
  ];

  // Convert DOCX to HTML
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap,
      // Include embedded styles for better formatting
      includeEmbeddedStyleMap: true,
      // Convert images to data URLs (we'll strip them but at least they won't break)
      convertImage: mammoth.images.inline(() => {
        // Return empty image - we don't support images in import yet
        return Promise.resolve({ src: "" });
      }),
    }
  );

  // Log any warnings for debugging
  if (result.messages.length > 0) {
    console.debug("[docx import] Conversion messages:", result.messages);
  }

  // Convert HTML to IR blocks using shared converter
  return htmlToBlocks(result.value);
}
