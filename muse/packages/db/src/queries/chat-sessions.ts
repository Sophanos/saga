/**
 * Chat Session Queries
 *
 * CRUD operations for chat sessions and messages with durable storage.
 */

import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeVoidMutation,
} from "../queryHelper";
import type { Database } from "../types/database";

// Type aliases for cleaner code
type ChatSession = Database["public"]["Tables"]["chat_sessions"]["Row"];
type ChatSessionInsert = Database["public"]["Tables"]["chat_sessions"]["Insert"];
type ChatSessionUpdate = Database["public"]["Tables"]["chat_sessions"]["Update"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
type ChatMessageInsert = Database["public"]["Tables"]["chat_messages"]["Insert"];

// =============================================================================
// Session Queries
// =============================================================================

/**
 * Get all sessions for a project, optionally filtered by user.
 * Ordered by last_message_at descending.
 */
export async function getSessions(
  projectId: string,
  userId?: string
): Promise<ChatSession[]> {
  return executeQuery<ChatSession>(
    (client) => {
      let query = client
        .from("chat_sessions")
        .select("*")
        .eq("project_id", projectId)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      return query;
    },
    { context: "fetch chat sessions" }
  );
}

/**
 * Get a single session by ID.
 */
export async function getSession(id: string): Promise<ChatSession | null> {
  return executeSingleQuery<ChatSession>(
    (client) => client.from("chat_sessions").select("*").eq("id", id).single(),
    { context: "fetch chat session" }
  );
}

/**
 * Create a new chat session.
 */
export async function createSession(
  session: ChatSessionInsert
): Promise<ChatSession> {
  return executeMutation<ChatSession>(
    (client) =>
      client
        .from("chat_sessions")
        .insert(session as never)
        .select()
        .single(),
    { context: "create chat session" }
  );
}

/**
 * Update an existing session (e.g., rename).
 */
export async function updateSession(
  id: string,
  updates: ChatSessionUpdate
): Promise<ChatSession> {
  return executeMutation<ChatSession>(
    (client) =>
      client
        .from("chat_sessions")
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update chat session" }
  );
}

/**
 * Delete a session (cascade deletes messages).
 */
export async function deleteSession(id: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("chat_sessions").delete().eq("id", id),
    { context: "delete chat session" }
  );
}

/**
 * Ensure a session exists (upsert pattern).
 * Creates if not exists, otherwise returns existing.
 */
export async function ensureSession(
  session: ChatSessionInsert
): Promise<ChatSession> {
  return executeMutation<ChatSession>(
    (client) =>
      client
        .from("chat_sessions")
        .upsert(session as never, { onConflict: "id", ignoreDuplicates: true })
        .select()
        .single(),
    { context: "ensure chat session" }
  );
}

// =============================================================================
// Message Queries
// =============================================================================

/**
 * Get all messages for a session, ordered by creation time.
 */
export async function getSessionMessages(
  sessionId: string
): Promise<ChatMessage[]> {
  return executeQuery<ChatMessage>(
    (client) =>
      client
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
    { context: "fetch session messages" }
  );
}

/**
 * Create a new message in a session.
 */
export async function createMessage(
  message: ChatMessageInsert
): Promise<ChatMessage> {
  return executeMutation<ChatMessage>(
    (client) =>
      client
        .from("chat_messages")
        .insert(message as never)
        .select()
        .single(),
    { context: "create chat message" }
  );
}

/**
 * Delete all messages in a session (clear chat).
 */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("chat_messages").delete().eq("session_id", sessionId),
    { context: "clear session messages" }
  );
}

// =============================================================================
// Export Types
// =============================================================================

export type {
  ChatSession,
  ChatSessionInsert,
  ChatSessionUpdate,
  ChatMessage,
  ChatMessageInsert,
};
