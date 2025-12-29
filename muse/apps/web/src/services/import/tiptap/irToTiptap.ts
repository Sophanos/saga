import type { ExportBlock, ExportInline, ExportMark } from "../../export/ir";
import type { TiptapDoc, TiptapNode, TiptapMark } from "../../export/tiptap/tiptapTypes";
import { NODE_TYPES, MARK_TYPES } from "../../export/tiptap/tiptapTypes";

// ============================================================================
// IR to Tiptap Converter
// ============================================================================

export interface IrToTiptapOptions {
  /** Ensure the document has at least one empty paragraph if no content */
  ensureNonEmptyDoc?: boolean;
  /** How to handle sceneBreak blocks */
  sceneBreakBehavior?: "horizontalRule" | "ignore";
}

const DEFAULT_OPTIONS: Required<IrToTiptapOptions> = {
  ensureNonEmptyDoc: true,
  sceneBreakBehavior: "horizontalRule",
};

/**
 * Convert IR blocks to a Tiptap document
 */
export function irToTiptapDoc(
  blocks: ExportBlock[],
  options?: IrToTiptapOptions
): TiptapDoc {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const content = blocks
    .map((block) => convertBlock(block, opts))
    .filter((node): node is TiptapNode => node !== null);

  // Ensure non-empty document
  if (opts.ensureNonEmptyDoc && content.length === 0) {
    content.push({
      type: NODE_TYPES.PARAGRAPH,
    });
  }

  return {
    type: NODE_TYPES.DOC,
    content,
  };
}

// ============================================================================
// Block Conversion
// ============================================================================

function convertBlock(
  block: ExportBlock,
  opts: Required<IrToTiptapOptions>
): TiptapNode | null {
  switch (block.kind) {
    case "heading":
      return {
        type: NODE_TYPES.HEADING,
        attrs: { level: block.level },
        content: convertInlines(block.inlines),
      };

    case "paragraph": {
      const content = convertInlines(block.inlines);
      return {
        type: NODE_TYPES.PARAGRAPH,
        ...(content.length > 0 ? { content } : {}),
      };
    }

    case "blockquote":
      return {
        type: NODE_TYPES.BLOCKQUOTE,
        content: block.blocks.map((b) => convertBlock(b, opts)).filter((n): n is TiptapNode => n !== null),
      };

    case "bulletList":
      return {
        type: NODE_TYPES.BULLET_LIST,
        content: block.items.map((itemBlocks) => ({
          type: NODE_TYPES.LIST_ITEM,
          content: itemBlocks.map((b) => convertBlock(b, opts)).filter((n): n is TiptapNode => n !== null),
        })),
      };

    case "orderedList":
      return {
        type: NODE_TYPES.ORDERED_LIST,
        attrs: block.start !== undefined ? { start: block.start } : undefined,
        content: block.items.map((itemBlocks) => ({
          type: NODE_TYPES.LIST_ITEM,
          content: itemBlocks.map((b) => convertBlock(b, opts)).filter((n): n is TiptapNode => n !== null),
        })),
      };

    case "codeBlock":
      return {
        type: NODE_TYPES.CODE_BLOCK,
        attrs: block.language ? { language: block.language } : undefined,
        content: block.text ? [{ type: NODE_TYPES.TEXT, text: block.text }] : undefined,
      };

    case "horizontalRule":
      return {
        type: NODE_TYPES.HORIZONTAL_RULE,
      };

    case "sceneBreak":
      if (opts.sceneBreakBehavior === "ignore") {
        return null;
      }
      // Convert to horizontal rule
      return {
        type: NODE_TYPES.HORIZONTAL_RULE,
      };

    default:
      // Unknown block type - skip
      console.warn(`[irToTiptap] Unknown block kind: ${(block as ExportBlock).kind}`);
      return null;
  }
}

// ============================================================================
// Inline Conversion
// ============================================================================

function convertInlines(inlines: ExportInline[]): TiptapNode[] {
  return inlines
    .map(convertInline)
    .filter((node): node is TiptapNode => node !== null);
}

function convertInline(inline: ExportInline): TiptapNode | null {
  switch (inline.kind) {
    case "text": {
      const node: TiptapNode = {
        type: NODE_TYPES.TEXT,
        text: inline.text,
      };
      
      if (inline.marks && inline.marks.length > 0) {
        node.marks = inline.marks.map(convertMark);
      }
      
      return node;
    }

    case "hardBreak":
      return {
        type: NODE_TYPES.HARD_BREAK,
      };

    default:
      return null;
  }
}

// ============================================================================
// Mark Conversion
// ============================================================================

function convertMark(mark: ExportMark): TiptapMark {
  switch (mark.kind) {
    case "bold":
      return { type: MARK_TYPES.BOLD };

    case "italic":
      return { type: MARK_TYPES.ITALIC };

    case "strike":
      return { type: MARK_TYPES.STRIKE };

    case "code":
      return { type: MARK_TYPES.CODE };

    case "underline":
      return { type: MARK_TYPES.UNDERLINE };

    case "link":
      return {
        type: MARK_TYPES.LINK,
        attrs: { href: mark.href },
      };

    case "entity":
      return {
        type: MARK_TYPES.ENTITY,
        attrs: {
          entityId: mark.entityId,
          entityType: mark.entityType,
        },
      };

    default:
      // Unknown mark - return as-is with kind as type
      return { type: (mark as ExportMark).kind };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an empty Tiptap document
 */
export function createEmptyTiptapDoc(): TiptapDoc {
  return {
    type: NODE_TYPES.DOC,
    content: [
      {
        type: NODE_TYPES.PARAGRAPH,
      },
    ],
  };
}

/**
 * Check if a Tiptap document is empty (no content or only empty paragraphs)
 */
export function isTiptapDocEmpty(doc: TiptapDoc): boolean {
  if (!doc.content || doc.content.length === 0) {
    return true;
  }

  // Check if all content nodes are empty paragraphs
  return doc.content.every((node) => {
    if (node.type !== NODE_TYPES.PARAGRAPH) {
      return false;
    }
    return !node.content || node.content.length === 0;
  });
}
