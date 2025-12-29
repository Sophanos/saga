// ============================================================================
// Tiptap JSON Types
// ============================================================================
// Lightweight types for Tiptap JSON structure without runtime dependency.
// Used for parsing document content during export.

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapDoc extends TiptapNode {
  type: "doc";
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTiptapDoc(value: unknown): value is TiptapDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as TiptapNode).type === "doc"
  );
}

export function isTiptapNode(value: unknown): value is TiptapNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as TiptapNode).type === "string"
  );
}

// ============================================================================
// Node Type Constants
// ============================================================================

export const NODE_TYPES = {
  DOC: "doc",
  PARAGRAPH: "paragraph",
  HEADING: "heading",
  TEXT: "text",
  HARD_BREAK: "hardBreak",
  BLOCKQUOTE: "blockquote",
  BULLET_LIST: "bulletList",
  ORDERED_LIST: "orderedList",
  LIST_ITEM: "listItem",
  CODE_BLOCK: "codeBlock",
  HORIZONTAL_RULE: "horizontalRule",
  SCENE_BLOCK: "sceneBlock",
} as const;

export const MARK_TYPES = {
  BOLD: "bold",
  ITALIC: "italic",
  STRIKE: "strike",
  CODE: "code",
  UNDERLINE: "underline",
  LINK: "link",
  ENTITY: "entity",
} as const;
