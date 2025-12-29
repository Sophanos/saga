import type { Document } from "@mythos/core";

// ============================================================================
// Story Tree Types
// ============================================================================

/**
 * A node in the story tree representing a document and its children
 */
export interface StoryNode {
  doc: Document;
  children: StoryNode[];
}

/**
 * Options for building the story tree
 */
export interface BuildStoryTreeOptions {
  /** Document types to include (default: ["chapter", "scene"]) */
  includeTypes?: Document["type"][];
}

// ============================================================================
// Story Tree Builder
// ============================================================================

const DEFAULT_INCLUDE_TYPES: Document["type"][] = ["chapter", "scene"];

/**
 * Build a hierarchical tree from a flat list of documents
 * 
 * Documents are organized by their parent-child relationships and sorted
 * by orderIndex within each parent.
 */
export function buildStoryTree(
  docs: Document[],
  opts?: BuildStoryTreeOptions
): StoryNode[] {
  const includeTypes = opts?.includeTypes ?? DEFAULT_INCLUDE_TYPES;

  // Filter to only include specified types
  const filteredDocs = docs.filter((doc) => includeTypes.includes(doc.type));

  // Create a map for quick lookup
  const docMap = new Map<string, Document>();
  for (const doc of filteredDocs) {
    docMap.set(doc.id, doc);
  }

  // Group children by parent ID
  const childrenByParent = new Map<string | null, Document[]>();
  
  for (const doc of filteredDocs) {
    const parentId = doc.parentId ?? null;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)!.push(doc);
  }

  // Sort each group by orderIndex
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  // Build tree recursively starting from root documents
  const rootDocs = childrenByParent.get(null) ?? [];
  
  return rootDocs.map((doc) => buildNode(doc, childrenByParent));
}

/**
 * Recursively build a tree node
 */
function buildNode(
  doc: Document,
  childrenByParent: Map<string | null, Document[]>
): StoryNode {
  const children = childrenByParent.get(doc.id) ?? [];
  
  return {
    doc,
    children: children.map((child) => buildNode(child, childrenByParent)),
  };
}

// ============================================================================
// Tree Traversal Utilities
// ============================================================================

/**
 * Flatten a story tree back to a list of documents in reading order
 */
export function flattenStoryTree(nodes: StoryNode[]): Document[] {
  const result: Document[] = [];
  
  for (const node of nodes) {
    flattenNode(node, result);
  }
  
  return result;
}

/**
 * Recursively flatten a node and its children
 */
function flattenNode(node: StoryNode, result: Document[]): void {
  result.push(node.doc);
  
  for (const child of node.children) {
    flattenNode(child, result);
  }
}

/**
 * Get all documents at a specific depth (0 = root, 1 = children of root, etc.)
 */
export function getDocsAtDepth(nodes: StoryNode[], depth: number): Document[] {
  if (depth === 0) {
    return nodes.map((node) => node.doc);
  }
  
  const result: Document[] = [];
  for (const node of nodes) {
    collectAtDepth(node.children, depth - 1, result);
  }
  return result;
}

function collectAtDepth(
  nodes: StoryNode[],
  depth: number,
  result: Document[]
): void {
  if (depth === 0) {
    for (const node of nodes) {
      result.push(node.doc);
    }
    return;
  }
  
  for (const node of nodes) {
    collectAtDepth(node.children, depth - 1, result);
  }
}

/**
 * Count total documents in a tree
 */
export function countTreeNodes(nodes: StoryNode[]): number {
  let count = 0;
  
  for (const node of nodes) {
    count += 1 + countTreeNodes(node.children);
  }
  
  return count;
}

/**
 * Find a node by document ID
 */
export function findNodeById(
  nodes: StoryNode[],
  id: string
): StoryNode | null {
  for (const node of nodes) {
    if (node.doc.id === id) {
      return node;
    }
    
    const found = findNodeById(node.children, id);
    if (found) {
      return found;
    }
  }
  
  return null;
}

/**
 * Get the path from root to a specific document
 */
export function getPathToNode(
  nodes: StoryNode[],
  id: string
): Document[] | null {
  for (const node of nodes) {
    if (node.doc.id === id) {
      return [node.doc];
    }
    
    const childPath = getPathToNode(node.children, id);
    if (childPath) {
      return [node.doc, ...childPath];
    }
  }
  
  return null;
}
