import type { Project, Document, Entity } from "@mythos/core";
import type { ExportOptions, ExportResult } from "./types";
import type { ExportSection } from "./ir";
import { buildStoryTree, flattenStoryTree } from "./storyTree";
import { tiptapDocToBlocks } from "./tiptap/tiptapToIr";
import { extractEntityIdsFromDocuments } from "./tiptap/extractEntityRefs";
import { buildGlossary, type GlossarySection } from "./glossary/buildGlossary";
import { downloadBlob } from "./utils/download";
import { sanitizeFileName } from "./utils/sanitizeFileName";

// Re-export types and utilities
export * from "./types";
export * from "./ir";
export * from "./storyTree";
export { buildGlossary, type GlossarySection } from "./glossary/buildGlossary";

// ============================================================================
// Export Orchestrator
// ============================================================================

export interface ExportStoryParams {
  /** Project to export */
  project: Project;
  /** All documents in the project */
  documents: Document[];
  /** All entities in the project */
  entities: Entity[];
  /** Export options */
  options: ExportOptions;
  /** Optional: current editor content (for unsaved changes in current document) */
  currentDocumentId?: string;
  currentEditorContent?: unknown;
}

/**
 * Main export function that orchestrates the entire export process
 * 
 * 1. Builds the document tree
 * 2. Converts Tiptap JSON to IR for each document
 * 3. Extracts referenced entities
 * 4. Builds glossary
 * 5. Renders to target format
 * 6. Triggers download
 */
export async function exportStory(params: ExportStoryParams): Promise<void> {
  const {
    project,
    documents,
    entities,
    options,
    currentDocumentId,
    currentEditorContent,
  } = params;

  // Step 1: Build story tree and flatten to ordered list
  const storyTree = buildStoryTree(documents);
  const orderedDocs = flattenStoryTree(storyTree);

  // Step 2: Prepare documents with possible editor override
  const docsWithContent = orderedDocs.map((doc) => {
    // If this is the current document and we have editor content, use it
    if (doc.id === currentDocumentId && currentEditorContent !== undefined) {
      return { ...doc, content: currentEditorContent };
    }
    return doc;
  });

  // Step 3: Convert each document to IR sections
  const sections = buildSections(docsWithContent);

  // Step 4: Extract referenced entity IDs
  const referencedIds = extractEntityIdsFromDocuments(
    docsWithContent.map((d) => ({ content: d.content }))
  );

  // Step 5: Build glossary if requested
  let glossary: GlossarySection[] | undefined;
  if (options.glossary.include) {
    glossary = buildGlossary(entities, {
      includeTypes: options.glossary.types,
      onlyReferenced: options.glossary.onlyReferenced,
      referencedIds,
    });
  }

  // Step 6: Render to target format
  const result = await renderToFormat({
    project,
    sections,
    glossary,
    options,
  });

  // Step 7: Apply custom filename if provided
  const fileName = options.fileName
    ? sanitizeFileName(options.fileName)
    : result.fileName;

  // Step 8: Trigger download
  downloadBlob(result.blob, fileName);
}

// ============================================================================
// Section Building
// ============================================================================

/**
 * Build export sections from ordered documents
 */
function buildSections(docs: Document[]): ExportSection[] {
  const sections: ExportSection[] = [];

  for (const doc of docs) {
    const blocks = tiptapDocToBlocks(doc.content);
    const level = doc.type === "chapter" ? 1 : 2;
    const title = doc.title || getDefaultTitle(doc.type, sections.length + 1);

    sections.push({
      id: doc.id,
      title,
      level: level as 1 | 2,
      blocks,
    });
  }

  return sections;
}

/**
 * Get a default title for untitled documents
 */
function getDefaultTitle(type: Document["type"], index: number): string {
  switch (type) {
    case "chapter":
      return `Chapter ${index}`;
    case "scene":
      return `Scene ${index}`;
    default:
      return `Section ${index}`;
  }
}

// ============================================================================
// Format Routing
// ============================================================================

interface RenderParams {
  project: Project;
  sections: ExportSection[];
  glossary?: GlossarySection[];
  options: ExportOptions;
}

/**
 * Route to the appropriate format renderer
 * 
 * Uses dynamic imports to keep initial bundle size small.
 */
async function renderToFormat(params: RenderParams): Promise<ExportResult> {
  const { options } = params;

  switch (options.format) {
    case "markdown": {
      const { renderMarkdown } = await import("./formats/markdown");
      return renderMarkdown(params);
    }

    case "docx": {
      const { renderDocx } = await import("./formats/docx");
      return renderDocx(params);
    }

    case "pdf": {
      const { renderPdf } = await import("./formats/pdf");
      return renderPdf(params);
    }

    case "epub": {
      const { renderEpub } = await import("./formats/epub");
      return renderEpub(params);
    }

    default: {
      // Fallback to markdown
      const { renderMarkdown } = await import("./formats/markdown");
      return renderMarkdown(params);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick export to markdown with default options
 */
export async function quickExportMarkdown(
  project: Project,
  documents: Document[],
  entities: Entity[]
): Promise<void> {
  await exportStory({
    project,
    documents,
    entities,
    options: {
      format: "markdown",
      includeTitlePage: true,
      includeToc: true,
      preserveEntityMarks: false,
      glossary: {
        include: true,
        types: ["character", "location"],
        onlyReferenced: true,
      },
    },
  });
}

/**
 * Export to a specific format with default options
 */
export async function quickExport(
  project: Project,
  documents: Document[],
  entities: Entity[],
  format: ExportOptions["format"]
): Promise<void> {
  await exportStory({
    project,
    documents,
    entities,
    options: {
      format,
      includeTitlePage: true,
      includeToc: true,
      preserveEntityMarks: false,
      glossary: {
        include: true,
        types: ["character", "location"],
        onlyReferenced: true,
      },
    },
  });
}
