import type { EntityType } from "@mythos/core";

// ============================================================================
// Export Format Types
// ============================================================================

export type ExportFormat = "epub" | "docx" | "markdown" | "pdf";

// ============================================================================
// Glossary Options
// ============================================================================

export interface ExportGlossaryOptions {
  /** Whether to include a glossary section */
  include: boolean;
  /** Entity types to include in the glossary */
  types: EntityType[];
  /** Only include entities that are actually referenced in the exported content */
  onlyReferenced: boolean;
}

// ============================================================================
// Export Options
// ============================================================================

export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Include a title page with project name and description */
  includeTitlePage: boolean;
  /** Include a table of contents */
  includeToc: boolean;
  /** Preserve entity highlighting/links in output */
  preserveEntityMarks: boolean;
  /** Glossary configuration */
  glossary: ExportGlossaryOptions;
  /** Custom file name (optional) */
  fileName?: string;
}

// ============================================================================
// Export Result
// ============================================================================

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  fileName: string;
}

// ============================================================================
// Default Options
// ============================================================================

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "markdown",
  includeTitlePage: true,
  includeToc: true,
  preserveEntityMarks: false,
  glossary: {
    include: true,
    types: ["character", "location"],
    onlyReferenced: true,
  },
};

// ============================================================================
// Format Metadata
// ============================================================================

export interface FormatMetadata {
  id: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
}

export const FORMAT_METADATA: Record<ExportFormat, FormatMetadata> = {
  markdown: {
    id: "markdown",
    label: "Markdown",
    extension: ".md",
    mimeType: "text/markdown",
    description: "Plain text with formatting. Great for version control.",
  },
  docx: {
    id: "docx",
    label: "Word Document",
    extension: ".docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description: "Microsoft Word format. Best for editing and sharing.",
  },
  pdf: {
    id: "pdf",
    label: "PDF",
    extension: ".pdf",
    mimeType: "application/pdf",
    description: "Portable Document Format. Best for printing and distribution.",
  },
  epub: {
    id: "epub",
    label: "EPUB",
    extension: ".epub",
    mimeType: "application/epub+zip",
    description: "E-book format. Compatible with most e-readers.",
  },
};
