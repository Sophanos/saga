/**
 * useSessionHistory Hook
 *
 * Orchestrates chat session persistence with the database.
 *
 * Responsibilities:
 * 1. Fetch sessions on mount / project change
 * 2. Load messages when resuming session
 * 3. Persist messages to DB (without writing on every stream delta)
 * 4. Handle session switching (save current → load new)
 */

import { useCallback, useEffect, useRef } from "react";
import {
  useMythosStore,
  useChatSessions,
  useSessionsLoading,
  useConversationId,
  useConversationName,
  useCurrentProject,
  type ChatMessage,
  type ChatSessionSummary,
  type ChatMention,
  type ChatToolInvocation,
} from "../stores";
import {
  getSessions,
  getSession,
  getSessionMessages,
  createMessage,
  updateSession,
  deleteSession as deleteSessionDb,
  ensureSession,
  type ChatSession,
  type ChatMessage as DbChatMessage,
  type ChatMessageInsert,
  type ChatSessionInsert,
} from "@mythos/db";
import { useAuthStore } from "../stores/auth";

/**
 * Map a store ChatMessage to a DB insert record
 */
function toChatMessageInsert(sessionId: string, m: ChatMessage): ChatMessageInsert {
  return {
    id: m.id,
    session_id: sessionId,
    role: m.role,
    content: m.content,
    mentions: m.mentions as unknown as Record<string, unknown>[] | null,
    tool: m.tool as unknown as Record<string, unknown> | null,
    created_at: m.timestamp.toISOString(),
  };
}

/**
 * Map a DB message to a store ChatMessage
 */
function fromDbMessage(m: DbChatMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role as ChatMessage["role"],
    content: m.content,
    timestamp: new Date(m.created_at),
    mentions: m.mentions as unknown as ChatMention[] | undefined,
    kind: m.tool ? "tool" : undefined,
    tool: m.tool as unknown as ChatToolInvocation | undefined,
  };
}

/**
 * Map a DB session to a ChatSessionSummary
 */
function toSessionSummary(s: ChatSession): ChatSessionSummary {
  return {
    id: s.id,
    name: s.name,
    lastMessageAt: s.last_message_at ? new Date(s.last_message_at) : null,
    messageCount: s.message_count,
  };
}

/**
 * Writer interface for persisting messages (consumed by useSagaAgent)
 */
export interface SagaSessionWriter {
  persistUserMessage: (m: ChatMessage) => void;
  persistAssistantMessage: (m: ChatMessage) => void;
  persistToolMessage: (m: ChatMessage) => void;
}

/**
 * Return type for useSessionHistory hook
 */
export interface UseSessionHistoryResult {
  sessions: ChatSessionSummary[];
  sessionsLoading: boolean;

  refreshSessions: () => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;

  renameActiveSession: (name: string | null) => Promise<void>;

  /** Writer API consumed by useSagaAgent */
  sessionWriter: SagaSessionWriter;
}

/**
 * Hook for managing chat session history with database persistence
 */
export function useSessionHistory(): UseSessionHistoryResult {
  const sessions = useChatSessions();
  const sessionsLoading = useSessionsLoading();
  const conversationId = useConversationId();
  const conversationName = useConversationName();
  const currentProject = useCurrentProject();
  const user = useAuthStore((s) => s.user);

  // Store actions
  const setSessions = useMythosStore((s) => s.setSessions);
  const setSessionsLoading = useMythosStore((s) => s.setSessionsLoading);
  const setSessionsError = useMythosStore((s) => s.setSessionsError);
  const addSessionToList = useMythosStore((s) => s.addSession);
  const removeSessionFromList = useMythosStore((s) => s.removeSession);
  const updateSessionInList = useMythosStore((s) => s.updateSessionInList);
  const loadSessionMessages = useMythosStore((s) => s.loadSessionMessages);
  const startNewConversation = useMythosStore((s) => s.startNewConversation);
  const setConversationName = useMythosStore((s) => s.setConversationName);
  const stopStreaming = useMythosStore((s) => s.setChatStreaming);

  // Track pending session ensure promises to deduplicate concurrent calls
  const sessionEnsurePromises = useRef<Map<string, Promise<boolean>>>(new Map());

  /**
   * Ensure the current session exists in the database
   */
  const ensureCurrentSession = useCallback(async (): Promise<boolean> => {
    const projectId = currentProject?.id;
    if (!projectId || !conversationId || !user?.id) return false;

    // Check if there's already a pending/completed promise for this session
    const existing = sessionEnsurePromises.current.get(conversationId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const sessionInsert: ChatSessionInsert = {
          id: conversationId,
          project_id: projectId,
          user_id: user?.id, // Explicitly pass user_id
          name: conversationName ?? undefined,
        };
        await ensureSession(sessionInsert);

        // Update session list if this is a new session
        addSessionToList({
          id: conversationId,
          name: conversationName,
          lastMessageAt: null,
          messageCount: 0,
        });

        return true;
      } catch (error) {
        console.error("Failed to ensure session:", error);
        sessionEnsurePromises.current.delete(conversationId); // Allow retry on failure
        return false;
      }
    })();

    sessionEnsurePromises.current.set(conversationId, promise);
    return promise;
  }, [currentProject?.id, conversationId, conversationName, user?.id, addSessionToList]);

  /**
   * Refresh session list from database
   */
  const refreshSessions = useCallback(async () => {
    const projectId = currentProject?.id;
    if (!projectId || !user?.id) return;

    setSessionsLoading(true);
    try {
      const dbSessions = await getSessions(projectId, user?.id);
      setSessions(dbSessions.map(toSessionSummary));
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      setSessionsError(error instanceof Error ? error.message : "Failed to load sessions");
    }
  }, [currentProject?.id, user?.id, setSessions, setSessionsLoading, setSessionsError]);

  /**
   * Open (switch to) a session by ID
   */
  const openSession = useCallback(
    async (sessionId: string) => {
      if (!user?.id) return;
      // Stop any current streaming
      stopStreaming(false);

      try {
        // Fetch session metadata
        const session = await getSession(sessionId);
        if (!session) {
          throw new Error("Session not found");
        }

        // Fetch messages
        const dbMessages = await getSessionMessages(sessionId);
        const messages = dbMessages.map(fromDbMessage);

        // Load into store
        loadSessionMessages(messages, sessionId, session.name);

        // Mark session as ensured (we just loaded it from DB)
        sessionEnsurePromises.current.set(sessionId, Promise.resolve(true));
      } catch (error) {
        console.error("Failed to open session:", error);
        setSessionsError(error instanceof Error ? error.message : "Failed to load session");
      }
    },
    [loadSessionMessages, stopStreaming, setSessionsError]
  );

  /**
   * Delete a session
   */
  const removeSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSessionDb(sessionId);
        removeSessionFromList(sessionId);
        sessionEnsurePromises.current.delete(sessionId);

        // If we deleted the current session, start a new one
        if (sessionId === conversationId) {
          startNewConversation();
        }
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    },
    [conversationId, removeSessionFromList, startNewConversation]
  );

  /**
   * Rename the active session
   */
  const renameActiveSession = useCallback(
    async (name: string | null) => {
      if (!conversationId) return;

      try {
        // Ensure session exists first
        const ensured = await ensureCurrentSession();
        if (!ensured) return;

        // Update in DB
        await updateSession(conversationId, { name });

        // Update in store
        setConversationName(name);
        updateSessionInList(conversationId, { name });
      } catch (error) {
        console.error("Failed to rename session:", error);
      }
    },
    [conversationId, ensureCurrentSession, setConversationName, updateSessionInList]
  );

  /**
   * Persist a message to DB (fire-and-forget)
   */
  const persistMessage = useCallback(
    (message: ChatMessage, role: "user" | "assistant" | "tool") => {
      (async () => {
        try {
          const ensured = await ensureCurrentSession();
          if (!ensured || !conversationId) return;
          await createMessage(toChatMessageInsert(conversationId, message));
        } catch (error) {
          console.error(`Failed to persist ${role} message:`, error);
        }
      })();
    },
    [conversationId, ensureCurrentSession]
  );

  /**
   * Load sessions on mount and project change
   */
  useEffect(() => {
    if (currentProject?.id) {
      refreshSessions();
    }
    // Clear ensured cache on project change
    sessionEnsurePromises.current.clear();
  }, [currentProject?.id, refreshSessions]);

  /**
   * Clear session promises on unmount
   */
  useEffect(() => {
    return () => {
      sessionEnsurePromises.current.clear();
    };
  }, []);

  const sessionWriter: SagaSessionWriter = {
    persistUserMessage: (m) => persistMessage(m, "user"),
    persistAssistantMessage: (m) => persistMessage(m, "assistant"),
    persistToolMessage: (m) => persistMessage(m, "tool"),
  };

  return {
    sessions,
    sessionsLoading,
    refreshSessions,
    openSession,
    removeSession,
    renameActiveSession,
    sessionWriter,
  };
}
