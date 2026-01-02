/**
 * Anonymous Session Store
 *
 * Manages temporary project data for unauthenticated users.
 * Enables "try before signup" flow with context preservation.
 *
 * Data stored in localStorage:
 * - Anonymous project (single project, no multi-project)
 * - Chat messages (limited to 5 before auth prompt)
 * - Import source (if they imported a story)
 * - Session actions (what they've done, for adaptive onboarding)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Entity } from "@mythos/core";
import type { MythosTrialPayloadV1, WriterPersonalizationV1 } from "@mythos/core/trial/payload";

// ============================================================================
// Types
// ============================================================================

export type AnonymousAction = "imported_story" | "used_chat" | "created_entity" | "edited_document";

export interface AnonymousChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AnonymousProject {
  id: string; // temp_xxx format
  name: string;
  description?: string;
  genre?: string;
  templateId?: string;
  createdAt: number;
}

export interface AnonymousDocument {
  id: string;
  projectId: string;
  title: string;
  content: unknown; // Tiptap JSON
  type: "chapter" | "scene" | "note" | "outline" | "worldbuilding";
  parentId?: string | null;
  orderIndex: number;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnonymousEntity {
  id: string;
  projectId: string;
  name: string;
  type: Entity["type"];
  properties: Record<string, unknown>;
  createdAt: number;
}

export interface AnonymousRelationship {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  type: string;
  createdAt: number;
}

interface AnonymousState {
  // Session tracking
  sessionId: string | null;
  sessionStartedAt: number | null;
  actions: AnonymousAction[];

  // Project data
  project: AnonymousProject | null;
  documents: AnonymousDocument[];
  entities: AnonymousEntity[];
  relationships: AnonymousRelationship[];

  // Chat data (limited)
  chatMessages: AnonymousChatMessage[];
  chatMessageCount: number;

  // Server-authoritative trial state
  serverTrialLimit: number | null;
  serverTrialUsed: number | null;
  serverTrialRemaining: number | null;
  isTrialExhausted: boolean;

  // Import tracking
  importSource: "file" | "paste" | null;
  importedContent: string | null;

  // Onboarding payload and personalization
  tryPayload: MythosTrialPayloadV1 | null;
  personalization: WriterPersonalizationV1 | null;
  hasImportedInitialDraft: boolean;
  hasRunTryBootstrap: boolean;
  importedDocumentIds: string[];
  welcomeDocumentId: string | null;

  // Auth prompts
  authPromptShown: boolean;
  authPromptDismissedAt: number | null;
}

interface AnonymousActions {
  // Session
  startSession: () => void;
  endSession: () => void;
  recordAction: (action: AnonymousAction) => void;

  // Project
  createProject: (data: Omit<AnonymousProject, "id" | "createdAt">) => string;
  updateProject: (updates: Partial<AnonymousProject>) => void;

  // Documents
  addDocument: (doc: Omit<AnonymousDocument, "id" | "createdAt" | "updatedAt" | "orderIndex" | "wordCount"> & { orderIndex?: number; wordCount?: number }) => string;
  updateDocument: (id: string, updates: Partial<AnonymousDocument>) => void;
  replaceDocuments: (docs: AnonymousDocument[]) => void;

  // Entities
  addEntity: (entity: Omit<AnonymousEntity, "id" | "createdAt">) => string;
  updateEntity: (id: string, updates: Partial<AnonymousEntity>) => void;
  replaceEntities: (entities: AnonymousEntity[]) => void;

  // Relationships
  addRelationship: (rel: Omit<AnonymousRelationship, "id" | "createdAt">) => string;
  replaceRelationships: (rels: AnonymousRelationship[]) => void;

  // Chat
  addChatMessage: (message: Omit<AnonymousChatMessage, "id" | "timestamp">) => boolean;
  clearChat: () => void;

  // Server trial status
  setServerTrialStatus: (status: { limit: number; used: number; remaining: number }) => void;
  markTrialExhausted: () => void;
  decrementServerTrialRemaining: () => void;

  // Import
  setImportedContent: (source: "file" | "paste", content: string) => void;
  setTryPayload: (payload: MythosTrialPayloadV1 | null) => void;
  setPersonalization: (personalization: WriterPersonalizationV1 | null) => void;
  markInitialDraftImported: (docIds: string[], welcomeDocId: string | null) => void;
  markTryBootstrapRun: () => void;

  // Auth prompts
  showAuthPrompt: () => void;
  dismissAuthPrompt: () => void;

  // Migration (called after auth)
  getDataForMigration: () => AnonymousDataForMigration;
  clearAllData: () => void;
}

export interface AnonymousDataForMigration {
  project: AnonymousProject | null;
  documents: AnonymousDocument[];
  entities: AnonymousEntity[];
  relationships: AnonymousRelationship[];
  chatMessages: AnonymousChatMessage[];
  actions: AnonymousAction[];
  importSource: "file" | "paste" | null;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_CHAT_MESSAGES = 5;
const STORAGE_KEY = "mythos:anonymous";

// ============================================================================
// Helpers
// ============================================================================

function generateTempId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Store
// ============================================================================

export const useAnonymousStore = create<AnonymousState & AnonymousActions>()(
  persist(
    immer((set, get) => ({
      // Initial state
      sessionId: null,
      sessionStartedAt: null,
      actions: [],
      project: null,
      documents: [],
      entities: [],
      relationships: [],
      chatMessages: [],
      chatMessageCount: 0,
      serverTrialLimit: null,
      serverTrialUsed: null,
      serverTrialRemaining: null,
      isTrialExhausted: false,
      importSource: null,
      importedContent: null,
      tryPayload: null,
      personalization: null,
      hasImportedInitialDraft: false,
      hasRunTryBootstrap: false,
      importedDocumentIds: [],
      welcomeDocumentId: null,
      authPromptShown: false,
      authPromptDismissedAt: null,

      // Session management
      startSession: () => {
        set((state) => {
          if (!state.sessionId) {
            state.sessionId = generateTempId("session");
            state.sessionStartedAt = Date.now();
          }
        });
      },

      endSession: () => {
        set((state) => {
          state.sessionId = null;
          state.sessionStartedAt = null;
        });
      },

      recordAction: (action) => {
        set((state) => {
          if (!state.actions.includes(action)) {
            state.actions.push(action);
          }
        });
      },

      // Project management
      createProject: (data) => {
        const id = generateTempId("temp_project");
        set((state) => {
          state.project = {
            id,
            ...data,
            createdAt: Date.now(),
          };
        });
        return id;
      },

      updateProject: (updates) => {
        set((state) => {
          if (state.project) {
            Object.assign(state.project, updates);
          }
        });
      },

      // Document management
      addDocument: (doc) => {
        const id = generateTempId("temp_doc");
        const now = Date.now();
        set((state) => {
          const orderIndex = doc.orderIndex ?? state.documents.length;
          const wordCount = doc.wordCount ?? 0;
          state.documents.push({
            id,
            ...doc,
            orderIndex,
            wordCount,
            createdAt: now,
            updatedAt: now,
          });
          state.recordAction("edited_document");
        });
        return id;
      },

      updateDocument: (id, updates) => {
        set((state) => {
          const doc = state.documents.find((d) => d.id === id);
          if (doc) {
            Object.assign(doc, updates, { updatedAt: Date.now() });
          }
        });
      },

      replaceDocuments: (docs) => {
        set((state) => {
          state.documents = docs;
        });
      },

      // Entity management
      addEntity: (entity) => {
        const id = generateTempId("temp_entity");
        set((state) => {
          state.entities.push({
            id,
            ...entity,
            createdAt: Date.now(),
          });
          state.recordAction("created_entity");
        });
        return id;
      },

      updateEntity: (id, updates) => {
        set((state) => {
          const entity = state.entities.find((e) => e.id === id);
          if (entity) {
            Object.assign(entity, updates);
          }
        });
      },

      replaceEntities: (entities) => {
        set((state) => {
          state.entities = entities;
        });
      },

      // Relationship management
      addRelationship: (rel) => {
        const id = generateTempId("temp_rel");
        set((state) => {
          state.relationships.push({
            id,
            ...rel,
            createdAt: Date.now(),
          });
        });
        return id;
      },

      replaceRelationships: (rels) => {
        set((state) => {
          state.relationships = rels;
        });
      },

      // Chat management (with limit)
      addChatMessage: (message) => {
        const { chatMessageCount } = get();

        if (chatMessageCount >= MAX_CHAT_MESSAGES) {
          // Hit limit, show auth prompt
          get().showAuthPrompt();
          return false;
        }

        set((state) => {
          state.chatMessages.push({
            id: generateTempId("msg"),
            ...message,
            timestamp: Date.now(),
          });
          state.chatMessageCount += 1;
          state.recordAction("used_chat");
        });
        return true;
      },

      clearChat: () => {
        set((state) => {
          state.chatMessages = [];
          // Don't reset count - they still used their messages
        });
      },

      // Server trial status
      setServerTrialStatus: (status) => {
        set((state) => {
          state.serverTrialLimit = status.limit;
          state.serverTrialUsed = status.used;
          state.serverTrialRemaining = status.remaining;
          state.isTrialExhausted = status.remaining <= 0;
        });
      },

      markTrialExhausted: () => {
        set((state) => {
          state.serverTrialRemaining = 0;
          state.isTrialExhausted = true;
          state.authPromptShown = true;
        });
      },

      decrementServerTrialRemaining: () => {
        set((state) => {
          if (state.serverTrialRemaining !== null && state.serverTrialRemaining > 0) {
            state.serverTrialRemaining -= 1;
            state.serverTrialUsed = (state.serverTrialUsed ?? 0) + 1;
            if (state.serverTrialRemaining <= 0) {
              state.isTrialExhausted = true;
              state.authPromptShown = true;
            }
          }
        });
      },

      // Import tracking
      setImportedContent: (source, content) => {
        set((state) => {
          state.importSource = source;
          state.importedContent = content;
          state.recordAction("imported_story");
        });
      },

      setTryPayload: (payload) => {
        set((state) => {
          state.tryPayload = payload;
        });
      },

      setPersonalization: (personalization) => {
        set((state) => {
          state.personalization = personalization;
        });
      },

      markInitialDraftImported: (docIds, welcomeDocId) => {
        set((state) => {
          state.hasImportedInitialDraft = true;
          state.importedDocumentIds = docIds;
          state.welcomeDocumentId = welcomeDocId;
        });
      },

      markTryBootstrapRun: () => {
        set((state) => {
          state.hasRunTryBootstrap = true;
        });
      },

      // Auth prompt management
      showAuthPrompt: () => {
        set((state) => {
          state.authPromptShown = true;
        });
      },

      dismissAuthPrompt: () => {
        set((state) => {
          state.authPromptShown = false;
          state.authPromptDismissedAt = Date.now();
        });
      },

      // Migration helpers
      getDataForMigration: () => {
        const state = get();
        return {
          project: state.project,
          documents: state.documents,
          entities: state.entities,
          relationships: state.relationships,
          chatMessages: state.chatMessages,
          actions: state.actions,
          importSource: state.importSource,
        };
      },

      clearAllData: () => {
        set((state) => {
          state.sessionId = null;
          state.sessionStartedAt = null;
          state.actions = [];
          state.project = null;
          state.documents = [];
          state.entities = [];
          state.relationships = [];
          state.chatMessages = [];
          state.chatMessageCount = 0;
          state.serverTrialLimit = null;
          state.serverTrialUsed = null;
          state.serverTrialRemaining = null;
          state.isTrialExhausted = false;
          state.importSource = null;
          state.importedContent = null;
          state.tryPayload = null;
          state.personalization = null;
          state.hasImportedInitialDraft = false;
          state.hasRunTryBootstrap = false;
          state.importedDocumentIds = [];
          state.welcomeDocumentId = null;
          state.authPromptShown = false;
          state.authPromptDismissedAt = null;
        });
      },
    })),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        sessionId: state.sessionId,
        sessionStartedAt: state.sessionStartedAt,
        actions: state.actions,
        project: state.project,
        documents: state.documents,
        entities: state.entities,
        relationships: state.relationships,
        chatMessages: state.chatMessages,
        chatMessageCount: state.chatMessageCount,
        // Note: Server trial state is NOT persisted - it comes from the server
        importSource: state.importSource,
        importedContent: state.importedContent,
        tryPayload: state.tryPayload,
        personalization: state.personalization,
        hasImportedInitialDraft: state.hasImportedInitialDraft,
        hasRunTryBootstrap: state.hasRunTryBootstrap,
        importedDocumentIds: state.importedDocumentIds,
        welcomeDocumentId: state.welcomeDocumentId,
        authPromptDismissedAt: state.authPromptDismissedAt,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const useHasAnonymousData = () =>
  useAnonymousStore((s) => s.project !== null || s.documents.length > 0 || s.chatMessages.length > 0);

export const useAnonymousActions = () => useAnonymousStore((s) => s.actions);

export const useShouldShowAuthPrompt = () =>
  useAnonymousStore((s) => s.authPromptShown && !s.authPromptDismissedAt);

/**
 * Get remaining chat messages
 * Prefers server-authoritative count, falls back to local count
 */
export const useRemainingChatMessages = () =>
  useAnonymousStore((s) => {
    // Server state takes precedence when available
    if (s.serverTrialRemaining !== null) {
      return s.serverTrialRemaining;
    }
    // Fall back to local count
    return MAX_CHAT_MESSAGES - s.chatMessageCount;
  });

/**
 * Check if trial is exhausted (server-authoritative)
 */
export const useIsTrialExhausted = () =>
  useAnonymousStore((s) => s.isTrialExhausted);

/**
 * Get full server trial status
 */
export const useServerTrialStatus = () =>
  useAnonymousStore((s) => ({
    limit: s.serverTrialLimit,
    used: s.serverTrialUsed,
    remaining: s.serverTrialRemaining,
    isExhausted: s.isTrialExhausted,
  }));
