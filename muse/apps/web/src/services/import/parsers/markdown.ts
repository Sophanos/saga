import type { ExportBlock, ExportInline, ExportMark } from "../../export/ir";

// ============================================================================
// Markdown Parser
// ============================================================================

/**
 * Parse Markdown into IR blocks.
 * 
 * Strategy:
 * - Use 'marked' to convert markdown to HTML
 * - Parse HTML into DOM
 * - Convert DOM to IR blocks
 */
export async function parseMarkdown(markdown: string): Promise<ExportBlock[]> {
  // Dynamic import to reduce bundle size
  const { marked } = await import("marked");

  // Configure marked for safe parsing
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  // Convert markdown to HTML
  const html = await marked.parse(markdown);

  // Parse HTML to DOM and convert to IR
  return htmlToBlocks(html);
}

// ============================================================================
// HTML to IR Conversion (shared with DOCX/EPUB)
// ============================================================================

/**
 * Convert HTML string to IR blocks using DOM parsing
 */
export function htmlToBlocks(html: string): ExportBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return convertChildNodes(doc.body);
}

/**
 * Convert child nodes of an element to IR blocks
 */
function convertChildNodes(parent: Element): ExportBlock[] {
  const blocks: ExportBlock[] = [];

  for (const node of Array.from(parent.childNodes)) {
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
 * Convert a single DOM node to IR block(s)
 */
function convertNode(node: Node): ExportBlock | ExportBlock[] | null {
  // Text nodes at block level become paragraphs if non-empty
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) {
      return {
        kind: "paragraph",
        inlines: [{ kind: "text", text }],
      };
    }
    return null;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as Element;
  const tagName = el.tagName.toLowerCase();

  switch (tagName) {
    case "h1":
      return { kind: "heading", level: 1, inlines: extractInlines(el) };
    case "h2":
      return { kind: "heading", level: 2, inlines: extractInlines(el) };
    case "h3":
      return { kind: "heading", level: 3, inlines: extractInlines(el) };
    case "h4":
      return { kind: "heading", level: 4, inlines: extractInlines(el) };
    case "h5":
      return { kind: "heading", level: 5, inlines: extractInlines(el) };
    case "h6":
      return { kind: "heading", level: 6, inlines: extractInlines(el) };

    case "p":
      return { kind: "paragraph", inlines: extractInlines(el) };

    case "blockquote":
      return { kind: "blockquote", blocks: convertChildNodes(el) };

    case "ul":
      return { kind: "bulletList", items: extractListItems(el) };

    case "ol": {
      const start = el.getAttribute("start");
      return {
        kind: "orderedList",
        items: extractListItems(el),
        start: start ? parseInt(start, 10) : undefined,
      };
    }

    case "pre": {
      const codeEl = el.querySelector("code");
      const text = codeEl?.textContent ?? el.textContent ?? "";
      const language = codeEl?.className.match(/language-(\w+)/)?.[1];
      return { kind: "codeBlock", text, language };
    }

    case "hr":
      return { kind: "horizontalRule" };

    case "br":
      // Block-level br becomes empty paragraph
      return { kind: "paragraph", inlines: [] };

    case "div":
    case "section":
    case "article":
    case "main":
    case "header":
    case "footer":
    case "aside":
      // Container elements - recurse into children
      return convertChildNodes(el);

    default:
      // Unknown block-level elements - try to extract as paragraph
      const inlines = extractInlines(el);
      if (inlines.length > 0) {
        return { kind: "paragraph", inlines };
      }
      return null;
  }
}

/**
 * Extract list items as arrays of blocks
 */
function extractListItems(list: Element): ExportBlock[][] {
  const items: ExportBlock[][] = [];

  for (const li of Array.from(list.querySelectorAll(":scope > li"))) {
    const itemBlocks: ExportBlock[] = [];

    // Check if li contains only inline content or has nested blocks
    const hasBlockChildren = Array.from(li.children).some((child) =>
      isBlockElement(child.tagName.toLowerCase())
    );

    if (hasBlockChildren) {
      itemBlocks.push(...convertChildNodes(li));
    } else {
      // Treat as single paragraph
      const inlines = extractInlines(li);
      if (inlines.length > 0) {
        itemBlocks.push({ kind: "paragraph", inlines });
      }
    }

    items.push(itemBlocks);
  }

  return items;
}

/**
 * Check if tag is a block-level element
 */
function isBlockElement(tagName: string): boolean {
  const blockTags = new Set([
    "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "ul", "ol", "li", "pre", "hr",
    "table", "section", "article", "aside", "header", "footer",
  ]);
  return blockTags.has(tagName);
}

/**
 * Extract inline elements from an element's content
 */
function extractInlines(el: Element): ExportInline[] {
  const inlines: ExportInline[] = [];
  extractInlinesFromNode(el, inlines, []);
  return inlines;
}

/**
 * Recursively extract inlines from a node, tracking active marks
 */
function extractInlinesFromNode(
  node: Node,
  inlines: ExportInline[],
  marks: ExportMark[]
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text) {
      inlines.push({
        kind: "text",
        text,
        marks: marks.length > 0 ? [...marks] : undefined,
      });
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const el = node as Element;
  const tagName = el.tagName.toLowerCase();

  // Handle inline elements
  switch (tagName) {
    case "br":
      inlines.push({ kind: "hardBreak" });
      return;

    case "strong":
    case "b":
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, [...marks, { kind: "bold" }]);
      }
      return;

    case "em":
    case "i":
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, [...marks, { kind: "italic" }]);
      }
      return;

    case "del":
    case "s":
    case "strike":
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, [...marks, { kind: "strike" }]);
      }
      return;

    case "code":
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, [...marks, { kind: "code" }]);
      }
      return;

    case "u":
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, [...marks, { kind: "underline" }]);
      }
      return;

    case "a": {
      const href = el.getAttribute("href") ?? "";
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, [...marks, { kind: "link", href }]);
      }
      return;
    }

    case "span": {
      // Check for entity mark (data-entity-id attribute)
      const entityId = el.getAttribute("data-entity-id");
      const entityType = el.getAttribute("data-entity-type");
      if (entityId && entityType) {
        for (const child of Array.from(el.childNodes)) {
          extractInlinesFromNode(child, inlines, [
            ...marks,
            { kind: "entity", entityId, entityType: entityType as ExportMark & { kind: "entity" } extends { entityType: infer T } ? T : never },
          ]);
        }
        return;
      }
      // Regular span - just recurse
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, marks);
      }
      return;
    }

    default:
      // Unknown inline element - just recurse into children
      for (const child of Array.from(el.childNodes)) {
        extractInlinesFromNode(child, inlines, marks);
      }
  }
}
