import type { EntityType } from "@mythos/core";

// ============================================================================
// Intermediate Representation (IR) for Export
// ============================================================================
// This IR provides a format-agnostic representation of document content
// that can be rendered to any export format (Markdown, DOCX, PDF, EPUB).

// ============================================================================
// Inline Marks
// ============================================================================

export type ExportMark =
  | { kind: "bold" }
  | { kind: "italic" }
  | { kind: "strike" }
  | { kind: "code" }
  | { kind: "underline" }
  | { kind: "link"; href: string }
  | { kind: "entity"; entityId: string; entityType: EntityType };

// ============================================================================
// Inline Elements
// ============================================================================

export type ExportInline =
  | { kind: "text"; text: string; marks?: ExportMark[] }
  | { kind: "hardBreak" };

// ============================================================================
// Block Elements
// ============================================================================

export type ExportBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: ExportInline[] }
  | { kind: "paragraph"; inlines: ExportInline[] }
  | { kind: "blockquote"; blocks: ExportBlock[] }
  | { kind: "bulletList"; items: ExportBlock[][] }
  | { kind: "orderedList"; items: ExportBlock[][]; start?: number }
  | { kind: "codeBlock"; text: string; language?: string }
  | { kind: "horizontalRule" }
  | { kind: "sceneBreak"; sceneId?: string; sceneName?: string };

// ============================================================================
// Document Section (Chapter/Scene with metadata)
// ============================================================================

export interface ExportSection {
  id: string;
  title: string;
  level: 1 | 2; // 1 = chapter, 2 = scene
  blocks: ExportBlock[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a text inline element
 */
export function text(content: string, marks?: ExportMark[]): ExportInline {
  return { kind: "text", text: content, marks };
}

/**
 * Create a paragraph block
 */
export function paragraph(inlines: ExportInline[]): ExportBlock {
  return { kind: "paragraph", inlines };
}

/**
 * Create a heading block
 */
export function heading(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  inlines: ExportInline[]
): ExportBlock {
  return { kind: "heading", level, inlines };
}

/**
 * Check if an inline has a specific mark
 */
export function hasMark(inline: ExportInline, kind: ExportMark["kind"]): boolean {
  if (inline.kind !== "text" || !inline.marks) return false;
  return inline.marks.some((m) => m.kind === kind);
}

/**
 * Get entity mark from an inline if present
 */
export function getEntityMark(
  inline: ExportInline
): Extract<ExportMark, { kind: "entity" }> | null {
  if (inline.kind !== "text" || !inline.marks) return null;
  const mark = inline.marks.find((m) => m.kind === "entity");
  return mark?.kind === "entity" ? mark : null;
}

/**
 * Extract plain text from inlines
 */
export function inlinesToText(inlines: ExportInline[]): string {
  return inlines
    .map((inline) => {
      if (inline.kind === "text") return inline.text;
      if (inline.kind === "hardBreak") return "\n";
      return "";
    })
    .join("");
}

/**
 * Extract plain text from blocks (recursive)
 */
export function blocksToText(blocks: ExportBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading":
        case "paragraph":
          return inlinesToText(block.inlines);
        case "blockquote":
          return blocksToText(block.blocks);
        case "bulletList":
        case "orderedList":
          return block.items.map((item) => blocksToText(item)).join("\n");
        case "codeBlock":
          return block.text;
        case "horizontalRule":
        case "sceneBreak":
          return "";
        default:
          return "";
      }
    })
    .join("\n\n");
}
