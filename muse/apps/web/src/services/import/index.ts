import type { Document, Entity, EntityType } from "@mythos/core";
import type { ExportBlock } from "../export/ir";
import { blocksToText, inlinesToText } from "../export/ir";
import type {
  ImportOptions,
  ImportResult,
  ImportProgress,
} from "./types";
import { readAsText, readAsArrayBuffer, detectFormatFromFile, stripExtension } from "./utils";
import { getParserForFormat, formatRequiresBinary } from "./parsers";
import { irToTiptapDoc } from "./tiptap";

// Re-export types
export * from "./types";
export { irToTiptapDoc, createEmptyTiptapDoc, isTiptapDocEmpty } from "./tiptap";

// ============================================================================
// Import Orchestrator
// ============================================================================

export interface ImportStoryParams {
  /** Project ID to import into */
  projectId: string;
  /** File to import */
  file: File;
  /** Import options */
  options: ImportOptions;
  /** Existing entities for matching during entity detection */
  existingEntities?: Entity[];
  /** Existing documents (for append mode orderIndex calculation) */
  existingDocuments?: Document[];
}

/**
 * Main import function that orchestrates the entire import process.
 * 
 * 1. Detects or validates format
 * 2. Reads file content
 * 3. Parses content to IR blocks
 * 4. Splits content by H1/H2 headings into documents
 * 5. Converts each document to Tiptap JSON
 * 6. Optionally runs entity detection
 * 7. Returns documents and entity upserts
 */
export async function importStory(params: ImportStoryParams): Promise<ImportResult> {
  const { projectId, file, options, existingEntities = [], existingDocuments = [] } = params;
  const { onProgress, signal } = options;

  // Helper to report progress
  const progress = (step: ImportProgress["step"], message: string, percent: number) => {
    onProgress?.({ step, message, percent });
  };

  // Step 1: Detect format
  progress("read", "Detecting file format...", 5);
  
  const format = options.format === "auto" 
    ? detectFormatFromFile(file) 
    : options.format;

  if (!format) {
    throw new Error(`Could not detect file format for: ${file.name}`);
  }

  // Check for abort
  if (signal?.aborted) {
    throw new DOMException("Import cancelled", "AbortError");
  }

  // Step 2: Read file
  progress("read", `Reading ${file.name}...`, 10);

  const fileContent = formatRequiresBinary(format)
    ? await readAsArrayBuffer(file, signal)
    : await readAsText(file, signal);

  if (signal?.aborted) {
    throw new DOMException("Import cancelled", "AbortError");
  }

  // Step 3: Parse to IR blocks
  progress("parse", `Parsing ${format} content...`, 25);

  const parser = await getParserForFormat(format);
  // Cast based on whether the format needs binary or text input
  const blocks = formatRequiresBinary(format)
    ? await (parser as (input: ArrayBuffer) => Promise<ExportBlock[]>)(fileContent as ArrayBuffer)
    : await (parser as (input: string) => Promise<ExportBlock[]> | ExportBlock[])(fileContent as string);

  if (signal?.aborted) {
    throw new DOMException("Import cancelled", "AbortError");
  }

  // Step 4: Split into documents by heading
  progress("structure", "Structuring chapters and scenes...", 50);

  const baseTitle = stripExtension(file.name);
  const docDrafts = splitBlocksByHeadings(blocks, baseTitle);

  // Calculate orderIndex offset for append mode
  let orderIndexOffset = 0;
  if (options.mode === "append" && existingDocuments.length > 0) {
    const rootDocs = existingDocuments.filter((d) => !d.parentId);
    orderIndexOffset = Math.max(...rootDocs.map((d) => d.orderIndex), -1) + 1;
  }

  if (signal?.aborted) {
    throw new DOMException("Import cancelled", "AbortError");
  }

  // Step 5: Convert each draft to Document with Tiptap content
  progress("tiptap", "Converting to editor format...", 65);

  const now = new Date();
  const documents: Document[] = docDrafts.map((draft) => {
    const tiptapDoc = irToTiptapDoc(draft.blocks);
    const plainText = blocksToText(draft.blocks);
    const wordCount = countWords(plainText);

    // Apply orderIndex offset for root chapters
    const finalOrderIndex = draft.parentId 
      ? draft.orderIndex 
      : draft.orderIndex + orderIndexOffset;

    return {
      id: draft.id,
      projectId,
      type: draft.type,
      title: draft.title,
      content: tiptapDoc,
      parentId: draft.parentId,
      orderIndex: finalOrderIndex,
      wordCount,
      createdAt: now,
      updatedAt: now,
    };
  });

  if (signal?.aborted) {
    throw new DOMException("Import cancelled", "AbortError");
  }

  // Step 6: Optional entity detection
  let entityUpserts: ImportResult["entityUpserts"];

  if (options.detectEntities && options.apiKey) {
    progress("entity-detect", "Detecting entities...", 80);

    try {
      entityUpserts = await detectEntitiesForImportedDocs({
        docs: documents.map((d) => ({
          id: d.id,
          blocks: docDrafts.find((draft) => draft.id === d.id)?.blocks ?? [],
        })),
        existingEntities,
        apiKey: options.apiKey,
        signal,
        entityTypes: options.entityTypes,
        projectId,
      });
    } catch (err) {
      // Don't fail import if entity detection fails
      console.warn("[import] Entity detection failed:", err);
    }
  }

  progress("done", "Import complete!", 100);

  return {
    detectedFormat: format,
    documents,
    entityUpserts,
  };
}

// ============================================================================
// Document Splitting
// ============================================================================

interface ImportDocDraft {
  id: string;
  type: "chapter" | "scene";
  parentId?: string;
  title: string;
  orderIndex: number;
  blocks: ExportBlock[];
}

/**
 * Split IR blocks into document drafts based on H1/H2 headings.
 * 
 * Rules:
 * - H1 starts a new chapter
 * - H2 starts a new scene (parent = current chapter)
 * - Heading text becomes document title (heading block is NOT included in content)
 * - Content before any heading goes into an implicit first chapter
 * - If no headings exist, create a single chapter with all content
 */
function splitBlocksByHeadings(blocks: ExportBlock[], baseTitle: string): ImportDocDraft[] {
  const drafts: ImportDocDraft[] = [];
  let currentChapter: ImportDocDraft | null = null;
  let currentDoc: ImportDocDraft | null = null;
  let chapterIndex = 0;
  let sceneIndex = 0;

  // Accumulator for blocks before first heading or between headings
  let pendingBlocks: ExportBlock[] = [];

  function flushPendingBlocks() {
    if (pendingBlocks.length === 0) return;

    if (!currentDoc) {
      // No current document - create implicit first chapter
      currentChapter = {
        id: generateId(),
        type: "chapter",
        title: baseTitle,
        orderIndex: chapterIndex++,
        blocks: [...pendingBlocks],
      };
      currentDoc = currentChapter;
      drafts.push(currentChapter);
    } else {
      // Append to current document
      currentDoc.blocks.push(...pendingBlocks);
    }

    pendingBlocks = [];
  }

  for (const block of blocks) {
    if (block.kind === "heading") {
      const headingText = inlinesToText(block.inlines).trim();

      if (block.level === 1) {
        // H1 = new chapter
        flushPendingBlocks();

        currentChapter = {
          id: generateId(),
          type: "chapter",
          title: headingText || `Chapter ${chapterIndex + 1}`,
          orderIndex: chapterIndex++,
          blocks: [],
        };
        currentDoc = currentChapter;
        sceneIndex = 0; // Reset scene index for new chapter
        drafts.push(currentChapter);
      } else if (block.level === 2) {
        // H2 = new scene
        flushPendingBlocks();

        // Ensure we have a parent chapter
        if (!currentChapter) {
          currentChapter = {
            id: generateId(),
            type: "chapter",
            title: baseTitle,
            orderIndex: chapterIndex++,
            blocks: [],
          };
          drafts.push(currentChapter);
        }

        const scene: ImportDocDraft = {
          id: generateId(),
          type: "scene",
          parentId: currentChapter.id,
          title: headingText || `Scene ${sceneIndex + 1}`,
          orderIndex: sceneIndex++,
          blocks: [],
        };
        currentDoc = scene;
        drafts.push(scene);
      } else {
        // H3-H6: keep as content block
        pendingBlocks.push(block);
      }
    } else {
      // Regular block - accumulate
      pendingBlocks.push(block);
    }
  }

  // Flush any remaining blocks
  flushPendingBlocks();

  // If no documents were created at all, create a single chapter
  if (drafts.length === 0) {
    drafts.push({
      id: generateId(),
      type: "chapter",
      title: baseTitle,
      orderIndex: 0,
      blocks: [],
    });
  }

  return drafts;
}

// ============================================================================
// Entity Detection
// ============================================================================

interface DetectParams {
  docs: Array<{ id: string; blocks: ExportBlock[] }>;
  existingEntities: Entity[];
  apiKey: string;
  signal?: AbortSignal;
  entityTypes: EntityType[];
  projectId: string;
}

/**
 * Detect entities across all imported documents.
 * Uses a single API call with offset tracking to map results back to documents.
 */
async function detectEntitiesForImportedDocs(
  params: DetectParams
): Promise<{ created: Entity[]; updated: Entity[] }> {
  const { docs, existingEntities, apiKey, signal, entityTypes, projectId } = params;

  // Build combined text with document offset tracking
  const docOffsets: Array<{ docId: string; startOffset: number; endOffset: number }> = [];
  let combinedText = "";

  for (const doc of docs) {
    const docText = blocksToText(doc.blocks);
    const startOffset = combinedText.length;
    combinedText += docText + "\n\n";
    docOffsets.push({
      docId: doc.id,
      startOffset,
      endOffset: combinedText.length - 2, // Exclude the trailing newlines
    });
  }

  if (combinedText.trim().length === 0) {
    return { created: [], updated: [] };
  }

  // Call detection API
  const { detectEntitiesViaEdge } = await import("../ai/detectClient");

  const response = await detectEntitiesViaEdge(
    {
      projectId,
      text: combinedText,
      existingEntities: existingEntities.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        aliases: e.aliases ?? [],
      })),
      options: {
        entityTypes,
      },
    },
    { apiKey, signal }
  );

  // Process detected entities
  const created: Entity[] = [];
  const updated: Entity[] = [];
  const existingById = new Map(existingEntities.map((e) => [e.id, e]));

  const now = new Date();

  for (const detected of response.entities) {
    // Find which document(s) this entity appears in based on occurrences
    const mentionDocIds = new Set<string>();
    for (const occurrence of detected.occurrences ?? []) {
      const docOffset = docOffsets.find(
        (d) => occurrence.startOffset >= d.startOffset && occurrence.startOffset < d.endOffset
      );
      if (docOffset) {
        mentionDocIds.add(docOffset.docId);
      }
    }

    if (detected.matchedExistingId) {
      // Update existing entity
      const existing = existingById.get(detected.matchedExistingId);
      if (existing) {
        // Merge aliases from suggestedAliases
        const allAliases = new Set([
          ...(existing.aliases ?? []),
          ...(detected.suggestedAliases ?? []),
        ]);
        if (detected.name !== existing.name) {
          allAliases.add(detected.name);
        }

        const updatedEntity: Entity = {
          ...existing,
          aliases: Array.from(allAliases),
          updatedAt: now,
        };
        updated.push(updatedEntity);
      }
    } else {
      // Create new entity with required base fields
      const newEntity = {
        id: generateId(),
        projectId,
        type: detected.type,
        name: detected.name,
        aliases: detected.suggestedAliases ?? [],
        properties: detected.inferredProperties ?? {},
        mentions: [],
        createdAt: now,
        updatedAt: now,
      } as Entity;
      created.push(newEntity);
    }
  }

  return { created, updated };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a UUID v4
 */
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick import with default options
 */
export async function quickImport(
  projectId: string,
  file: File,
  options?: Partial<ImportOptions>
): Promise<ImportResult> {
  return importStory({
    projectId,
    file,
    options: {
      format: "auto",
      mode: "append",
      detectEntities: false,
      entityTypes: ["character", "location"],
      ...options,
    },
  });
}
