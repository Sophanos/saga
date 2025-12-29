import type { EntityType } from "@mythos/core";
import type { ExportBlock, ExportInline, ExportMark } from "../ir";
import type { TiptapNode, TiptapMark } from "./tiptapTypes";
import { isTiptapDoc, NODE_TYPES, MARK_TYPES } from "./tiptapTypes";

// ============================================================================
// Tiptap to IR Converter
// ============================================================================

/**
 * Convert a Tiptap document to IR blocks
 */
export function tiptapDocToBlocks(doc: unknown): ExportBlock[] {
  if (!isTiptapDoc(doc)) {
    // If not a valid doc, return empty
    return [];
  }

  if (!doc.content) {
    return [];
  }

  return convertNodes(doc.content);
}

/**
 * Convert an array of Tiptap nodes to IR blocks
 */
function convertNodes(nodes: TiptapNode[]): ExportBlock[] {
  const blocks: ExportBlock[] = [];

  for (const node of nodes) {
    const block = convertNode(node);
    if (block) {
      if (Array.isArray(block)) {
        blocks.push(...block);
      } else {
        blocks.push(block);
      }
    }
  }

  return blocks;
}

/**
 * Convert a single Tiptap node to an IR block (or blocks)
 */
function convertNode(node: TiptapNode): ExportBlock | ExportBlock[] | null {
  switch (node.type) {
    case NODE_TYPES.PARAGRAPH:
      return {
        kind: "paragraph",
        inlines: convertInlines(node.content),
      };

    case NODE_TYPES.HEADING: {
      const level = (node.attrs?.["level"] as number) ?? 1;
      const validLevel = Math.max(1, Math.min(6, level)) as 1 | 2 | 3 | 4 | 5 | 6;
      return {
        kind: "heading",
        level: validLevel,
        inlines: convertInlines(node.content),
      };
    }

    case NODE_TYPES.BLOCKQUOTE:
      return {
        kind: "blockquote",
        blocks: node.content ? convertNodes(node.content) : [],
      };

    case NODE_TYPES.BULLET_LIST:
      return {
        kind: "bulletList",
        items: convertListItems(node.content),
      };

    case NODE_TYPES.ORDERED_LIST:
      return {
        kind: "orderedList",
        items: convertListItems(node.content),
        start: (node.attrs?.["start"] as number) ?? 1,
      };

    case NODE_TYPES.CODE_BLOCK:
      return {
        kind: "codeBlock",
        text: extractCodeBlockText(node),
        language: (node.attrs?.["language"] as string) ?? undefined,
      };

    case NODE_TYPES.HORIZONTAL_RULE:
      return {
        kind: "horizontalRule",
      };

    case NODE_TYPES.SCENE_BLOCK: {
      // Scene blocks contain inner content - extract and convert
      const innerBlocks = node.content ? convertNodes(node.content) : [];
      const sceneBreak: ExportBlock = {
        kind: "sceneBreak",
        sceneId: (node.attrs?.["sceneId"] as string) ?? undefined,
        sceneName: (node.attrs?.["sceneName"] as string) ?? undefined,
      };
      return [sceneBreak, ...innerBlocks];
    }

    case NODE_TYPES.LIST_ITEM:
      // List items are handled by convertListItems
      return null;

    case NODE_TYPES.TEXT:
    case NODE_TYPES.HARD_BREAK:
      // These are inline nodes, handled by convertInlines
      return null;

    default:
      // Unknown block type - try to extract content as paragraph
      if (node.content) {
        return {
          kind: "paragraph",
          inlines: convertInlines(node.content),
        };
      }
      return null;
  }
}

/**
 * Convert list item nodes to arrays of blocks
 */
function convertListItems(nodes: TiptapNode[] | undefined): ExportBlock[][] {
  if (!nodes) return [];

  return nodes
    .filter((node) => node.type === NODE_TYPES.LIST_ITEM)
    .map((listItem) => {
      if (!listItem.content) return [];
      return convertNodes(listItem.content);
    });
}

/**
 * Convert inline nodes (text, hardBreak) to IR inlines
 */
function convertInlines(nodes: TiptapNode[] | undefined): ExportInline[] {
  if (!nodes) return [];

  const inlines: ExportInline[] = [];

  for (const node of nodes) {
    if (node.type === NODE_TYPES.TEXT && node.text) {
      inlines.push({
        kind: "text",
        text: node.text,
        marks: node.marks ? convertMarks(node.marks) : undefined,
      });
    } else if (node.type === NODE_TYPES.HARD_BREAK) {
      inlines.push({ kind: "hardBreak" });
    }
    // Ignore other inline types
  }

  return inlines;
}

/**
 * Convert Tiptap marks to IR marks
 */
function convertMarks(marks: TiptapMark[]): ExportMark[] {
  const result: ExportMark[] = [];

  for (const mark of marks) {
    const irMark = convertMark(mark);
    if (irMark) {
      result.push(irMark);
    }
  }

  return result;
}

/**
 * Convert a single Tiptap mark to an IR mark
 */
function convertMark(mark: TiptapMark): ExportMark | null {
  switch (mark.type) {
    case MARK_TYPES.BOLD:
      return { kind: "bold" };

    case MARK_TYPES.ITALIC:
      return { kind: "italic" };

    case MARK_TYPES.STRIKE:
      return { kind: "strike" };

    case MARK_TYPES.CODE:
      return { kind: "code" };

    case MARK_TYPES.UNDERLINE:
      return { kind: "underline" };

    case MARK_TYPES.LINK:
      return {
        kind: "link",
        href: (mark.attrs?.["href"] as string) ?? "",
      };

    case MARK_TYPES.ENTITY:
      return {
        kind: "entity",
        entityId: (mark.attrs?.["entityId"] as string) ?? "",
        entityType: (mark.attrs?.["entityType"] as EntityType) ?? "character",
      };

    default:
      return null;
  }
}

/**
 * Extract text content from a code block node
 */
function extractCodeBlockText(node: TiptapNode): string {
  if (!node.content) return "";

  return node.content
    .filter((child) => child.type === NODE_TYPES.TEXT && child.text)
    .map((child) => child.text!)
    .join("");
}
