/**
 * Time formatting utilities
 *
 * Consolidated time formatting functions used across web and mobile apps.
 */

/**
 * Format a date as a relative time string (e.g., "2m ago", "1h ago", "3d ago")
 *
 * @param date - Date string or Date object to format
 * @returns Relative time string
 *
 * @example
 * formatTimeAgo(new Date()) // "just now"
 * formatTimeAgo("2024-01-01T12:00:00Z") // "3d ago" (depending on current time)
 */
export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  // Handle future dates
  if (diffMs < 0) {
    return "just now";
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  // Fallback to locale date for very old dates
  return d.toLocaleDateString();
}

/**
 * Format a date as a relative time string
 *
 * Alias for formatTimeAgo for backward compatibility and semantic clarity.
 *
 * @param date - Date string or Date object to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  return formatTimeAgo(date);
}

/**
 * Format a date as a simple time string (e.g., "2:30 PM")
 *
 * @param date - Date string or Date object to format
 * @returns Formatted time string
 */
export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a date as a time string with 2-digit hours (e.g., "02:30 PM")
 *
 * @param date - Date string or Date object to format
 * @returns Formatted time string with 2-digit hours
 */
export function formatTime24(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get a time group label for grouping items by day
 *
 * @param date - Date to categorize
 * @returns "Today", "Yesterday", or "Earlier"
 */
export function getTimeGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (entryDate.getTime() === today.getTime()) {
    return "Today";
  } else if (entryDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return "Earlier";
  }
}
