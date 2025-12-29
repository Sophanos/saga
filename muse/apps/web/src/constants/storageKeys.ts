/**
 * Centralized storage keys for localStorage and sessionStorage
 * This prevents drift and makes it easier to track what's being stored.
 */

/** Key for persisting the last opened project ID */
export const LAST_PROJECT_KEY = "mythos:lastProjectId";

/** Key for storing pending invitation token during auth flows */
export const PENDING_INVITE_TOKEN_KEY = "mythos:pendingInviteToken";
