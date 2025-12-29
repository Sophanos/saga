import type { TiptapNode, TiptapMark } from "./tiptapTypes";
import { isTiptapDoc, MARK_TYPES } from "./tiptapTypes";

// ============================================================================
// Entity Reference Extraction
// ============================================================================

/**
 * Extract all unique entity IDs referenced in a Tiptap document
 * 
 * This traverses the document structure and collects entity IDs from
 * entity marks, which are used to build the glossary for exported content.
 */
export function extractEntityIdsFromTiptap(doc: unknown): Set<string> {
  const entityIds = new Set<string>();

  if (!isTiptapDoc(doc)) {
    return entityIds;
  }

  if (doc.content) {
    traverseNodes(doc.content, entityIds);
  }

  return entityIds;
}

/**
 * Recursively traverse nodes and collect entity IDs from marks
 */
function traverseNodes(nodes: TiptapNode[], entityIds: Set<string>): void {
  for (const node of nodes) {
    // Check marks on this node
    if (node.marks) {
      collectEntityIdsFromMarks(node.marks, entityIds);
    }

    // Recursively check child nodes
    if (node.content) {
      traverseNodes(node.content, entityIds);
    }
  }
}

/**
 * Collect entity IDs from an array of marks
 */
function collectEntityIdsFromMarks(
  marks: TiptapMark[],
  entityIds: Set<string>
): void {
  for (const mark of marks) {
    if (mark.type === MARK_TYPES.ENTITY && mark.attrs?.["entityId"]) {
      const entityId = mark.attrs["entityId"];
      if (typeof entityId === "string" && entityId.length > 0) {
        entityIds.add(entityId);
      }
    }
  }
}

/**
 * Extract entity IDs from multiple Tiptap documents
 */
export function extractEntityIdsFromDocuments(
  docs: Array<{ content: unknown }>
): Set<string> {
  const allEntityIds = new Set<string>();

  for (const doc of docs) {
    const docEntityIds = extractEntityIdsFromTiptap(doc.content);
    for (const id of docEntityIds) {
      allEntityIds.add(id);
    }
  }

  return allEntityIds;
}
