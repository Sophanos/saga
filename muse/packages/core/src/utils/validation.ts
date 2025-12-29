/**
 * Validation utilities
 *
 * Canonical source for validation patterns used across the codebase.
 *
 * Note: Supabase edge functions cannot import from @mythos/core directly,
 * so they maintain a local copy. See supabase/functions/invite-member/index.ts
 */

/**
 * Email validation regex pattern.
 *
 * This pattern validates:
 * - No whitespace or @ in the local part
 * - At least one @ separator
 * - No whitespace or @ in the domain
 * - At least one dot in the domain
 * - No whitespace or @ in the TLD
 *
 * For most user-facing validation, this strikes a good balance between
 * strictness and avoiding false rejections of valid addresses.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address format.
 *
 * @param email - The email address to validate
 * @returns true if the email format is valid
 *
 * @example
 * ```ts
 * isValidEmail('user@example.com') // true
 * isValidEmail('invalid-email') // false
 * isValidEmail('') // false
 * ```
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}
