import type { ImportFormat } from "../types";
import { IMPORT_FORMAT_METADATA } from "../types";

// ============================================================================
// File Reader Utilities
// ============================================================================

/**
 * Read a file as text with optional abort support
 */
export async function readAsText(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const reader = new FileReader();

    const handleAbort = () => {
      reader.abort();
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", handleAbort);

    reader.onload = () => {
      signal?.removeEventListener("abort", handleAbort);
      resolve(reader.result as string);
    };

    reader.onerror = () => {
      signal?.removeEventListener("abort", handleAbort);
      reject(new Error(`Failed to read file: ${reader.error?.message ?? "Unknown error"}`));
    };

    reader.readAsText(file);
  });
}

/**
 * Read a file as ArrayBuffer with optional abort support
 */
export async function readAsArrayBuffer(file: File, signal?: AbortSignal): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const reader = new FileReader();

    const handleAbort = () => {
      reader.abort();
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", handleAbort);

    reader.onload = () => {
      signal?.removeEventListener("abort", handleAbort);
      resolve(reader.result as ArrayBuffer);
    };

    reader.onerror = () => {
      signal?.removeEventListener("abort", handleAbort);
      reject(new Error(`Failed to read file: ${reader.error?.message ?? "Unknown error"}`));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get file extension (lowercase, without dot)
 */
export function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === name.length - 1) {
    return "";
  }
  return name.slice(lastDot + 1).toLowerCase();
}

/**
 * Strip file extension from name
 */
export function stripExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1) {
    return name;
  }
  return name.slice(0, lastDot);
}

/**
 * Detect import format from file extension and MIME type
 */
export function detectFormatFromFile(file: File): ImportFormat | null {
  const ext = "." + getFileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  // Check each format's metadata
  for (const format of Object.values(IMPORT_FORMAT_METADATA)) {
    // Check extensions first (more reliable)
    if (format.extensions.includes(ext)) {
      return format.id;
    }
    // Fall back to MIME type
    if (mimeType && format.mimeTypes.includes(mimeType)) {
      return format.id;
    }
  }

  return null;
}

/**
 * Validate that a file can be imported
 */
export function validateImportFile(file: File): { valid: boolean; error?: string } {
  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: "File is too large (max 50MB)" };
  }

  // Check if format is detectable
  const format = detectFormatFromFile(file);
  if (!format) {
    const ext = getFileExtension(file.name);
    return {
      valid: false,
      error: ext
        ? `Unsupported file format: .${ext}`
        : "Could not detect file format",
    };
  }

  return { valid: true };
}
