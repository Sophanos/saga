// ============================================================================
// File Name Sanitization
// ============================================================================

/**
 * Characters that are not allowed in file names across common operating systems
 */
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Reserved names in Windows
 */
const RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/**
 * Maximum file name length (without extension)
 */
const MAX_NAME_LENGTH = 200;

/**
 * Sanitize a string to be safe for use as a file name
 * 
 * - Removes or replaces invalid characters
 * - Handles reserved names
 * - Trims whitespace and dots
 * - Limits length
 */
export function sanitizeFileName(name: string, fallback = "export"): string {
  if (!name || typeof name !== "string") {
    return fallback;
  }

  // Replace invalid characters with underscores
  let sanitized = name.replace(INVALID_CHARS, "_");

  // Replace multiple consecutive underscores/spaces with single underscore
  sanitized = sanitized.replace(/[_\s]+/g, "_");

  // Trim leading/trailing whitespace, dots, and underscores
  sanitized = sanitized.replace(/^[.\s_]+|[.\s_]+$/g, "");

  // Handle reserved names
  const upperName = sanitized.toUpperCase();
  if (RESERVED_NAMES.has(upperName)) {
    sanitized = `_${sanitized}`;
  }

  // Limit length
  if (sanitized.length > MAX_NAME_LENGTH) {
    sanitized = sanitized.slice(0, MAX_NAME_LENGTH);
  }

  // Final fallback if empty
  if (!sanitized) {
    return fallback;
  }

  return sanitized;
}

/**
 * Create a slug from a string (lowercase, hyphenated)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Generate a unique file name by appending a number if needed
 */
export function makeUniqueName(
  baseName: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 1;
  let uniqueName: string;
  
  do {
    uniqueName = `${baseName}_${counter}`;
    counter++;
  } while (existingNames.has(uniqueName) && counter < 1000);

  return uniqueName;
}
