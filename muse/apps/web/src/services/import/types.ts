import type { Document, Entity, EntityType } from "@mythos/core";

// ============================================================================
// Import Format Types
// ============================================================================

export type ImportFormat = "markdown" | "docx" | "epub" | "plaintext";
export type ImportFormatSelection = ImportFormat | "auto";

export type ImportMode = "append" | "replace";

// ============================================================================
// Progress Tracking
// ============================================================================

export type ImportStep =
  | "read"
  | "parse"
  | "structure"
  | "tiptap"
  | "entity-detect"
  | "done";

export interface ImportProgress {
  step: ImportStep;
  message: string;
  percent: number; // 0..100
}

export type ImportProgressCallback = (progress: ImportProgress) => void;

// ============================================================================
// Import Options
// ============================================================================

export interface ImportOptions {
  /** Import format (auto-detect or explicit) */
  format: ImportFormatSelection;
  /** How to handle existing documents */
  mode: ImportMode;
  /** Whether to run entity detection on imported content */
  detectEntities: boolean;
  /** Entity types to detect */
  entityTypes: EntityType[];
  /** Progress callback */
  onProgress?: ImportProgressCallback;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** API key for entity detection */
  apiKey?: string;
}

// ============================================================================
// Import Result
// ============================================================================

export interface ImportResult {
  /** The format that was detected/used */
  detectedFormat: ImportFormat;
  /** Imported documents */
  documents: Document[];
  /** Entity upserts (if detection was enabled) */
  entityUpserts?: {
    created: Entity[];
    updated: Entity[];
  };
}

// ============================================================================
// Default Options
// ============================================================================

export const DEFAULT_IMPORT_OPTIONS: Omit<ImportOptions, "onProgress" | "signal" | "apiKey"> = {
  format: "auto",
  mode: "append",
  detectEntities: false,
  entityTypes: ["character", "location"],
};

// ============================================================================
// Format Metadata
// ============================================================================

export interface ImportFormatMetadata {
  id: ImportFormat;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  description: string;
}

export const IMPORT_FORMAT_METADATA: Record<ImportFormat, ImportFormatMetadata> = {
  markdown: {
    id: "markdown",
    label: "Markdown",
    extensions: [".md", ".markdown", ".mdown", ".mkd"],
    mimeTypes: ["text/markdown", "text/x-markdown"],
    description: "Markdown formatted text files.",
  },
  docx: {
    id: "docx",
    label: "Word Document",
    extensions: [".docx"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    description: "Microsoft Word documents.",
  },
  epub: {
    id: "epub",
    label: "EPUB",
    extensions: [".epub"],
    mimeTypes: ["application/epub+zip"],
    description: "E-book format files.",
  },
  plaintext: {
    id: "plaintext",
    label: "Plain Text",
    extensions: [".txt", ".text"],
    mimeTypes: ["text/plain"],
    description: "Plain text files without formatting.",
  },
};
