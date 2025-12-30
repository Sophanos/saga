/**
 * Shared utilities for image tool executors
 *
 * Contains common validation functions and constants used across
 * analyzeImage, createEntityFromImage, and other image-related tools.
 */

// =============================================================================
// Constants
// =============================================================================

/** Maximum base64 image size in bytes (10MB - matches server limit) */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// =============================================================================
// Validation Types
// =============================================================================

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates that a base64 data URL does not exceed the maximum size limit.
 *
 * @param dataUrl - The image data URL to validate (e.g., "data:image/png;base64,...")
 * @returns Validation result with error message if invalid
 */
export function validateBase64ImageSize(dataUrl: string): ValidationResult {
  if (!dataUrl.startsWith("data:image/")) {
    return { valid: true }; // Not a data URL, skip validation
  }

  const match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!match) {
    return { valid: false, error: "Invalid image data URL format" };
  }

  const base64Part = match[1];
  // Estimate actual bytes from base64 (roughly 3/4 of base64 length)
  const estimatedBytes = Math.ceil(base64Part.length * 0.75);

  if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (estimatedBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image is too large (${sizeMB}MB). Maximum size is 10MB.`,
    };
  }

  return { valid: true };
}

/**
 * Validates that required context properties are present for image operations.
 *
 * @param ctx - The execution context containing projectId and apiKey
 * @param operation - The name of the operation (for error messages)
 * @returns Validation result with error message if invalid
 */
export function validateImageToolContext(
  ctx: { projectId?: string; apiKey?: string },
  operation: string
): ValidationResult {
  if (!ctx.projectId) {
    return { valid: false, error: `Project ID is required for ${operation}` };
  }
  if (!ctx.apiKey) {
    return { valid: false, error: `API key is required for ${operation}` };
  }
  return { valid: true };
}
