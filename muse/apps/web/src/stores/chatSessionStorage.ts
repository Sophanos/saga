/**
 * Chat Session Storage
 *
 * Lightweight persistence for conversation metadata without storing full message history.
 * Uses localStorage to persist session state across page refreshes.
 */

const STORAGE_KEY = "mythos.chat.session.v1";

/**
 * Persisted chat session metadata
 */
export interface PersistedChatSession {
  /** Active conversation ID (server thread ID, if known) */
  conversationId: string | null;
  /** User-defined conversation name (null if not set) */
  conversationName: string | null;
  /** Whether this is a new conversation (no messages sent yet) */
  isNewConversation: boolean;
}

/**
 * Load chat session from localStorage
 * @returns The persisted session or null if not found/invalid
 */
export function loadChatSession(): PersistedChatSession | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as unknown;

    // Validate shape
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "conversationId" in parsed
    ) {
      const session = parsed as PersistedChatSession;
      const conversationId =
        typeof session.conversationId === "string"
          ? session.conversationId.trim() || null
          : session.conversationId ?? null;

      return {
        conversationId,
        conversationName: session.conversationName ?? null,
        isNewConversation: session.isNewConversation ?? true,
      };
    }

    return null;
  } catch {
    // Corrupted data, return null
    return null;
  }
}

/**
 * Save chat session to localStorage
 * @param session The session metadata to persist
 */
export function saveChatSession(session: PersistedChatSession): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage full or unavailable, silently fail
  }
}

/**
 * Clear chat session from localStorage
 */
export function clearChatSession(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}
