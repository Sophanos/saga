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
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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
import { useAuthStore } from "../stores/auth";

/**
 * Map a store ChatMessage to a DB insert record
 */
function toChatMessageInsert(sessionId: string, m: ChatMessage) {
  return {
    threadId: sessionId,
    messageId: m.id,
    role: m.role,
    content: m.content,
    mentions: m.mentions as unknown as Record<string, unknown>[] | undefined,
    tool: m.tool as unknown as Record<string, unknown> | undefined,
    createdAt: m.timestamp.getTime(),
  };
}

/**
 * Map a DB message to a store ChatMessage
 */
function fromDbMessage(m: {
  _id: Id<"chatMessages">;
  messageId?: string | null;
  role: string;
  content: string;
  mentions?: Record<string, unknown>[] | null;
  tool?: Record<string, unknown> | null;
  createdAt: number;
}): ChatMessage {
  return {
    id: m.messageId ?? m._id,
    role: m.role as ChatMessage["role"],
    content: m.content,
    timestamp: new Date(m.createdAt),
    mentions: m.mentions as unknown as ChatMention[] | undefined,
    kind: m.tool ? "tool" : undefined,
    tool: m.tool as unknown as ChatToolInvocation | undefined,
  };
}

/**
 * Map a DB session to a ChatSessionSummary
 */
function toSessionSummary(s: {
  _id: Id<"chatSessions">;
  threadId: string;
  name?: string | null;
  lastMessageAt?: number | null;
  messageCount?: number | null;
}): ChatSessionSummary {
  return {
    id: s.threadId,
    name: s.name ?? null,
    lastMessageAt: s.lastMessageAt ? new Date(s.lastMessageAt) : null,
    messageCount: s.messageCount ?? 0,
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
  const convex = useConvex();
  const ensureSessionMutation = useMutation(api.chatSessions.ensureSession);
  const createMessageMutation = useMutation(api.chatSessions.createMessage);
  const updateSessionMutation = useMutation(api.chatSessions.updateSession);
  const removeSessionMutation = useMutation(api.chatSessions.removeSession);

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
        const session = await ensureSessionMutation({
          projectId: projectId as Id<"projects">,
          threadId: conversationId,
          name: conversationName ?? undefined,
        });

        addSessionToList(toSessionSummary(session));

        return true;
      } catch (error) {
        console.error("Failed to ensure session:", error);
        sessionEnsurePromises.current.delete(conversationId); // Allow retry on failure
        return false;
      }
    })();

    sessionEnsurePromises.current.set(conversationId, promise);
    return promise;
  }, [currentProject?.id, conversationId, conversationName, user?.id, ensureSessionMutation, addSessionToList]);

  /**
   * Refresh session list from database
   */
  const refreshSessions = useCallback(async () => {
    const projectId = currentProject?.id;
    if (!projectId || !user?.id) return;

    setSessionsLoading(true);
    try {
      const dbSessions = await convex.query(api.chatSessions.listByProject, {
        projectId: projectId as Id<"projects">,
      });
      setSessions((dbSessions ?? []).map(toSessionSummary));
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      setSessionsError(error instanceof Error ? error.message : "Failed to load sessions");
    }
  }, [convex, currentProject?.id, user?.id, setSessions, setSessionsLoading, setSessionsError]);

  /**
   * Open (switch to) a session by ID
   */
  const openSession = useCallback(
    async (sessionId: string) => {
      if (!user?.id || !currentProject?.id) return;
      // Stop any current streaming
      stopStreaming(false);

      try {
        // Fetch session metadata
        const session = await convex.query(api.chatSessions.getByThread, {
          projectId: currentProject.id as Id<"projects">,
          threadId: sessionId,
        });
        if (!session) {
          throw new Error("Session not found");
        }

        // Fetch messages
        const dbMessages = await convex.query(api.chatSessions.listMessages, {
          projectId: currentProject.id as Id<"projects">,
          threadId: sessionId,
        });
        const messages = (dbMessages ?? []).map(fromDbMessage);

        // Load into store
        loadSessionMessages(messages, sessionId, session.name ?? null);

        // Mark session as ensured (we just loaded it from DB)
        sessionEnsurePromises.current.set(sessionId, Promise.resolve(true));
      } catch (error) {
        console.error("Failed to open session:", error);
        setSessionsError(error instanceof Error ? error.message : "Failed to load session");
      }
    },
    [convex, currentProject?.id, loadSessionMessages, stopStreaming, setSessionsError, user?.id]
  );

  /**
   * Delete a session
   */
  const removeSession = useCallback(
    async (sessionId: string) => {
      if (!currentProject?.id) return;
      try {
        await removeSessionMutation({
          projectId: currentProject.id as Id<"projects">,
          threadId: sessionId,
        });
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
    [conversationId, currentProject?.id, removeSessionFromList, removeSessionMutation, startNewConversation]
  );

  /**
   * Rename the active session
   */
  const renameActiveSession = useCallback(
    async (name: string | null) => {
      if (!conversationId || !currentProject?.id) return;

      try {
        // Ensure session exists first
        const ensured = await ensureCurrentSession();
        if (!ensured) return;

        // Update in DB
        await updateSessionMutation({
          projectId: currentProject.id as Id<"projects">,
          threadId: conversationId,
          name: name ?? undefined,
        });

        // Update in store
        setConversationName(name);
        updateSessionInList(conversationId, { name });
      } catch (error) {
        console.error("Failed to rename session:", error);
      }
    },
    [
      conversationId,
      currentProject?.id,
      ensureCurrentSession,
      setConversationName,
      updateSessionInList,
      updateSessionMutation,
    ]
  );

  /**
   * Persist a message to DB (fire-and-forget)
   */
  const persistMessage = useCallback(
    (message: ChatMessage, role: "user" | "assistant" | "tool") => {
      (async () => {
        try {
          const ensured = await ensureCurrentSession();
          if (!ensured || !conversationId || !currentProject?.id) return;
          await createMessageMutation({
            projectId: currentProject.id as Id<"projects">,
            ...toChatMessageInsert(conversationId, message),
          });
        } catch (error) {
          console.error(`Failed to persist ${role} message:`, error);
        }
      })();
    },
    [conversationId, createMessageMutation, currentProject?.id, ensureCurrentSession]
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
