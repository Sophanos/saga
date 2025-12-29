// ============================================================================
// Download Utilities
// ============================================================================

/**
 * Trigger a file download in the browser
 * 
 * Creates a temporary anchor element to download the blob with the given filename.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  // Create object URL
  const url = URL.createObjectURL(blob);

  // Create temporary anchor element
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  
  // Append to body (required for Firefox)
  document.body.appendChild(anchor);
  
  // Trigger download
  anchor.click();
  
  // Cleanup
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Create a text blob with proper encoding
 */
export function createTextBlob(content: string, mimeType: string): Blob {
  return new Blob([content], { type: `${mimeType};charset=utf-8` });
}

/**
 * Create a binary blob
 */
export function createBinaryBlob(data: ArrayBuffer | Uint8Array, mimeType: string): Blob {
  return new Blob([data as BlobPart], { type: mimeType });
}
