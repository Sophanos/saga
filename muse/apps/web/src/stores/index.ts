import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import type {
  Entity,
  EntityType,
  Character,
  Location,
  Relationship,
  Project,
  Document,
} from "@mythos/core";
import type { ConsistencyIssue } from "@mythos/ai";
import type { Editor } from "@mythos/editor";

// Import shared tool types from agent-protocol (single source of truth)
import type {
  ToolName,
  ToolInvocationStatus,
  ToolArtifactKind,
  ToolArtifact,
  ToolProgress,
} from "@mythos/agent-protocol";

// Re-export for backwards compatibility
export type {
  ToolName,
  ToolInvocationStatus,
  ToolArtifactKind,
  ToolArtifact,
  ToolProgress,
};

// Project slice
interface ProjectState {
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

// Document slice
interface DocumentState {
  currentDocument: Document | null;
  documents: Document[];
  isLoading: boolean;
}

// World slice (entities and relationships)
interface WorldState {
  entities: Map<string, Entity>;
  relationships: Relationship[];
  selectedEntityId: string | null;
}

// Editor slice
// Note: editorInstance is stored as unknown to avoid immer proxy issues with complex objects
interface EditorState {
  content: unknown; // Tiptap JSON content
  wordCount: number;
  tensionLevel: number;
  isDirty: boolean;
  editorInstance: unknown; // Tiptap editor instance (stored as unknown to avoid immer conflicts)
}

/**
 * LinterIssue extends ConsistencyIssue with an id for keying and optional fix data
 */
export interface LinterIssue extends ConsistencyIssue {
  id: string;
  /** Whether this issue can be auto-fixed */
  fixable?: boolean;
  /** Fix data for auto-fix functionality */
  fix?: {
    oldText: string;
    newText: string;
  };
}

// Linter slice
interface LinterState {
  issues: LinterIssue[];
  isRunning: boolean;
  lastRunAt: Date | null;
  /** Error message if linting failed */
  error: string | null;
  /** Hash of the last linted content for deduplication */
  lastLintedHash: string | null;
  /** Currently selected issue ID */
  selectedIssueId: string | null;
}

// Console tab type - shared between UIState and setActiveTab action
export type ConsoleTab = "chat" | "search" | "linter" | "activity" | "dynamics" | "coach" | "history";

// Canvas view type for switching between editor and world graph
export type CanvasView = "editor" | "worldGraph";

// Modal state types
export type FormMode = "create" | "edit";

// Template picker step type
export type TemplatePickerStep = "start" | "browse" | "ai-builder" | "preview" | "create";

export type ModalState =
  | { type: "settings" }
  | { type: "import" }
  | { type: "export" }
  | { type: "entityForm"; mode: FormMode; entityType?: EntityType; entityId?: string }
  | { type: "templatePicker"; step: TemplatePickerStep; templateId?: string }
  | { type: "inviteMember" }
  | { type: "profile" };

// Recent items tracking
export interface RecentItems {
  documentIds: string[];
  entityIds: string[];
}

// Search types
export type SearchMode = "fulltext" | "semantic" | "hybrid";
export type SearchScope = "all" | "documents" | "entities";

export interface DocumentSearchHit {
  id: string;
  title?: string;
  type: Document["type"];
  score: number;
  scoreKind: "rank" | "similarity" | "combined";
  preview?: string;
}

export interface EntitySearchHit {
  id: string;
  name: string;
  type: Entity["type"];
  score: number;
  scoreKind: "similarity" | "match";
  preview?: string;
}

export interface SearchResults {
  documents: DocumentSearchHit[];
  entities: EntitySearchHit[];
}

interface SearchState {
  query: string;
  mode: SearchMode;
  scope: SearchScope;
  results: SearchResults;
  isSearching: boolean;
  error: string | null;
  lastRunAt: Date | null;
  source: { kind: "query" } | { kind: "entity"; entityId: string };
}

// Chat types
export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMessageKind = "text" | "tool";

export interface ChatMention {
  type: "entity" | "document";
  id: string;
  name: string;
}

/**
 * A tool invocation attached to a chat message.
 * Tracks the full lifecycle from proposal to execution.
 */
export interface ChatToolInvocation {
  /** Stable identifier from the LLM tool call */
  toolCallId: string;
  /** Which tool is being invoked */
  toolName: ToolName;
  /** Tool-specific arguments */
  args: unknown;
  /** Current status in the lifecycle */
  status: ToolInvocationStatus;
  /** Execution result (tool-specific) */
  result?: unknown;
  /** Artifacts produced by the tool */
  artifacts?: ToolArtifact[];
  /** Progress for long-running operations */
  progress?: ToolProgress;
  /** Error message if failed */
  error?: string;
  /** Workflow grouping (for multi-tool operations) */
  workflowId?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  /** Mentioned entity/document IDs for context */
  mentions?: ChatMention[];
  /** Whether this message is still being streamed */
  isStreaming?: boolean;
  /** Message kind - text or tool invocation */
  kind?: ChatMessageKind;
  /** Tool invocation data (if kind === "tool") */
  tool?: ChatToolInvocation;
}

export interface ChatContextItem {
  id: string;
  title: string;
  type: string;
  preview: string;
}

export interface ChatContext {
  /** Retrieved documents from RAG */
  documents: ChatContextItem[];
  /** Retrieved entities from RAG */
  entities: ChatContextItem[];
}

// Chat slice
interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  conversationId: string | null;
  /** Last retrieved context for debugging/display */
  lastContext: ChatContext | null;
}

// UI slice
interface UIState {
  activeTab: ConsoleTab;
  canvasView: CanvasView;
  manifestCollapsed: boolean;
  consoleCollapsed: boolean;
  hudEntity: Entity | null; // Entity being shown in ASCII HUD
  hudPosition: { x: number; y: number } | null; // Position for HUD popup
  mode: "writer" | "dm"; // Current editor mode
  modal: ModalState | null; // Currently open modal
  recent: RecentItems; // Recently accessed items
}

// Combined store
interface MythosStore {
  // State
  project: ProjectState;
  document: DocumentState;
  world: WorldState;
  editor: EditorState;
  linter: LinterState;
  search: SearchState;
  chat: ChatState;
  ui: UIState;

  // Project actions
  setCurrentProject: (project: Project | null) => void;
  setProjectLoading: (loading: boolean) => void;
  setProjectError: (error: string | null) => void;

  // Document actions
  setCurrentDocument: (document: Document | null) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  setDocuments: (documents: Document[]) => void;
  clearDocuments: () => void;

  // World actions
  addEntity: (entity: Entity) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  removeEntity: (id: string) => void;
  addRelationship: (relationship: Relationship) => void;
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  removeRelationship: (id: string) => void;
  setRelationships: (relationships: Relationship[]) => void;
  setSelectedEntity: (id: string | null) => void;
  setEntities: (entities: Entity[]) => void;
  clearWorld: () => void;

  // Project switching
  resetForProjectSwitch: () => void;

  // Editor actions
  setEditorContent: (content: unknown) => void;
  setWordCount: (count: number) => void;
  setTensionLevel: (level: number) => void;
  setDirty: (dirty: boolean) => void;
  setEditorInstance: (editor: unknown) => void;

  // Linter actions
  setLinterIssues: (issues: LinterIssue[]) => void;
  addLinterIssue: (issue: LinterIssue) => void;
  removeLinterIssue: (id: string) => void;
  clearLinterIssues: () => void;
  setLinterRunning: (running: boolean) => void;
  setLinterError: (error: string | null) => void;
  setLastLintedHash: (hash: string | null) => void;
  setSelectedLinterIssue: (id: string | null) => void;
  markLinterIssueFixed: (id: string) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchMode: (mode: SearchMode) => void;
  setSearchScope: (scope: SearchScope) => void;
  setSearchResults: (results: SearchResults, source?: SearchState["source"]) => void;
  clearSearch: () => void;
  setSearching: (isSearching: boolean) => void;
  setSearchError: (error: string | null) => void;

  // Chat actions
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  appendToChatMessage: (id: string, content: string) => void;
  updateToolStatus: (messageId: string, status: ToolInvocationStatus, error?: string) => void;
  updateToolInvocation: (messageId: string, patch: Partial<ChatToolInvocation>) => void;
  setChatStreaming: (streaming: boolean) => void;
  setChatError: (error: string | null) => void;
  setChatContext: (context: ChatContext | null) => void;
  clearChat: () => void;
  startNewConversation: () => void;

  // UI actions
  setActiveTab: (tab: ConsoleTab) => void;
  setCanvasView: (view: CanvasView) => void;
  toggleManifest: () => void;
  toggleConsole: () => void;
  showHud: (entity: Entity | null, position?: { x: number; y: number }) => void;
  setMode: (mode: "writer" | "dm") => void;
  toggleMode: () => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
}

export const useMythosStore = create<MythosStore>()(
  immer((set) => ({
    // Initial state
    project: {
      currentProject: null,
      isLoading: false,
      error: null,
    },
    document: {
      currentDocument: null,
      documents: [],
      isLoading: false,
    },
    world: {
      entities: new Map(),
      relationships: [],
      selectedEntityId: null,
    },
    editor: {
      content: null,
      wordCount: 0,
      tensionLevel: 50, // 0-100 scale, matches SceneContextBar thresholds
      isDirty: false,
      editorInstance: null,
    },
    linter: {
      issues: [],
      isRunning: false,
      lastRunAt: null,
      error: null,
      lastLintedHash: null,
      selectedIssueId: null,
    },
    search: {
      query: "",
      mode: "semantic",
      scope: "all",
      results: { documents: [], entities: [] },
      isSearching: false,
      error: null,
      lastRunAt: null,
      source: { kind: "query" },
    },
    chat: {
      messages: [],
      isStreaming: false,
      error: null,
      conversationId: null,
      lastContext: null,
    },
    ui: {
      activeTab: "linter",
      canvasView: "editor",
      manifestCollapsed: false,
      consoleCollapsed: false,
      hudEntity: null,
      hudPosition: null,
      mode: "writer",
      modal: null,
      recent: { documentIds: [], entityIds: [] },
    },

    // Project actions
    setCurrentProject: (project) =>
      set((state) => {
        state.project.currentProject = project;
      }),
    setProjectLoading: (loading) =>
      set((state) => {
        state.project.isLoading = loading;
      }),
    setProjectError: (error) =>
      set((state) => {
        state.project.error = error;
      }),

    // Document actions
    setCurrentDocument: (document) =>
      set((state) => {
        state.document.currentDocument = document;
        // Track recent documents
        if (document) {
          const recent = state.ui.recent.documentIds.filter(id => id !== document.id);
          state.ui.recent.documentIds = [document.id, ...recent].slice(0, 10);
        }
      }),
    addDocument: (document) =>
      set((state) => {
        state.document.documents.push(document);
      }),
    updateDocument: (id, updates) =>
      set((state) => {
        const idx = state.document.documents.findIndex((d) => d.id === id);
        if (idx !== -1) {
          Object.assign(state.document.documents[idx], updates);
        }
      }),
    setDocuments: (documents) =>
      set((state) => {
        state.document.documents = documents;
      }),
    clearDocuments: () =>
      set((state) => {
        state.document.documents = [];
        state.document.currentDocument = null;
      }),

    // World actions
    addEntity: (entity) =>
      set((state) => {
        state.world.entities.set(entity.id, entity);
      }),
    updateEntity: (id, updates) =>
      set((state) => {
        const entity = state.world.entities.get(id);
        if (entity) {
          state.world.entities.set(id, { ...entity, ...updates } as Entity);
        }
      }),
    removeEntity: (id) =>
      set((state) => {
        state.world.entities.delete(id);
        state.world.relationships = state.world.relationships.filter(
          (r) => r.sourceId !== id && r.targetId !== id
        );
      }),
    addRelationship: (relationship) =>
      set((state) => {
        state.world.relationships.push(relationship);
      }),
    updateRelationship: (id, updates) =>
      set((state) => {
        const idx = state.world.relationships.findIndex((r) => r.id === id);
        if (idx !== -1) {
          state.world.relationships[idx] = {
            ...state.world.relationships[idx],
            ...updates,
          } as Relationship;
        }
      }),
    removeRelationship: (id) =>
      set((state) => {
        state.world.relationships = state.world.relationships.filter(
          (r) => r.id !== id
        );
      }),
    setRelationships: (relationships) =>
      set((state) => {
        state.world.relationships = relationships;
      }),
    setSelectedEntity: (id) =>
      set((state) => {
        state.world.selectedEntityId = id;
        // Track recent entities
        if (id) {
          const recent = state.ui.recent.entityIds.filter(eid => eid !== id);
          state.ui.recent.entityIds = [id, ...recent].slice(0, 10);
        }
      }),
    setEntities: (entities) =>
      set((state) => {
        state.world.entities.clear();
        entities.forEach((entity) => {
          state.world.entities.set(entity.id, entity);
        });
      }),
    clearWorld: () =>
      set((state) => {
        state.world.entities.clear();
        state.world.relationships = [];
        state.world.selectedEntityId = null;
      }),

    // Project switching
    resetForProjectSwitch: () =>
      set((state) => {
        // Clear documents
        state.document.documents = [];
        state.document.currentDocument = null;
        // Clear world
        state.world.entities.clear();
        state.world.relationships = [];
        state.world.selectedEntityId = null;
        // Clear linter
        state.linter.issues = [];
        state.linter.isRunning = false;
        state.linter.lastRunAt = null;
        state.linter.error = null;
        state.linter.lastLintedHash = null;
        state.linter.selectedIssueId = null;
        // Clear search
        state.search.query = "";
        state.search.results = { documents: [], entities: [] };
        state.search.isSearching = false;
        state.search.error = null;
        state.search.lastRunAt = null;
        state.search.source = { kind: "query" };
        // Clear chat
        state.chat.messages = [];
        state.chat.isStreaming = false;
        state.chat.error = null;
        state.chat.conversationId = null;
        state.chat.lastContext = null;
        // Reset editor dirty state
        state.editor.isDirty = false;
      }),

    // Editor actions
    setEditorContent: (content) =>
      set((state) => {
        state.editor.content = content;
        state.editor.isDirty = true;
      }),
    setWordCount: (count) =>
      set((state) => {
        state.editor.wordCount = count;
      }),
    setTensionLevel: (level) =>
      set((state) => {
        state.editor.tensionLevel = level;
      }),
    setDirty: (dirty) =>
      set((state) => {
        state.editor.isDirty = dirty;
      }),
    setEditorInstance: (editor) =>
      set((state) => {
        state.editor.editorInstance = editor;
      }),

    // Linter actions
    setLinterIssues: (issues) =>
      set((state) => {
        state.linter.issues = issues;
        state.linter.lastRunAt = new Date();
        state.linter.error = null;
      }),
    addLinterIssue: (issue) =>
      set((state) => {
        state.linter.issues.push(issue);
      }),
    removeLinterIssue: (id) =>
      set((state) => {
        state.linter.issues = state.linter.issues.filter((i) => i.id !== id);
        if (state.linter.selectedIssueId === id) {
          state.linter.selectedIssueId = null;
        }
      }),
    clearLinterIssues: () =>
      set((state) => {
        state.linter.issues = [];
        state.linter.selectedIssueId = null;
      }),
    setLinterRunning: (running) =>
      set((state) => {
        state.linter.isRunning = running;
        if (running) {
          state.linter.error = null;
        }
      }),
    setLinterError: (error) =>
      set((state) => {
        state.linter.error = error;
        state.linter.isRunning = false;
      }),
    setLastLintedHash: (hash) =>
      set((state) => {
        state.linter.lastLintedHash = hash;
      }),
    setSelectedLinterIssue: (id) =>
      set((state) => {
        state.linter.selectedIssueId = id;
      }),
    markLinterIssueFixed: (id) =>
      set((state) => {
        state.linter.issues = state.linter.issues.filter((i) => i.id !== id);
        if (state.linter.selectedIssueId === id) {
          state.linter.selectedIssueId = null;
        }
      }),

    // Search actions
    setSearchQuery: (query) =>
      set((state) => {
        state.search.query = query;
      }),
    setSearchMode: (mode) =>
      set((state) => {
        state.search.mode = mode;
      }),
    setSearchScope: (scope) =>
      set((state) => {
        state.search.scope = scope;
      }),
    setSearchResults: (results, source) =>
      set((state) => {
        state.search.results = results;
        state.search.source = source ?? { kind: "query" };
        state.search.lastRunAt = new Date();
        state.search.error = null;
        state.search.isSearching = false;
      }),
    clearSearch: () =>
      set((state) => {
        state.search.query = "";
        state.search.results = { documents: [], entities: [] };
        state.search.error = null;
        state.search.isSearching = false;
        state.search.lastRunAt = null;
        state.search.source = { kind: "query" };
      }),
    setSearching: (isSearching) =>
      set((state) => {
        state.search.isSearching = isSearching;
        if (isSearching) {
          state.search.error = null;
        }
      }),
    setSearchError: (error) =>
      set((state) => {
        state.search.error = error;
        state.search.isSearching = false;
      }),

    // Chat actions
    addChatMessage: (message) =>
      set((state) => {
        state.chat.messages.push(message);
        state.chat.error = null;
      }),
    updateChatMessage: (id, updates) =>
      set((state) => {
        const idx = state.chat.messages.findIndex((m) => m.id === id);
        if (idx !== -1) {
          Object.assign(state.chat.messages[idx], updates);
        }
      }),
    appendToChatMessage: (id, content) =>
      set((state) => {
        const idx = state.chat.messages.findIndex((m) => m.id === id);
        if (idx !== -1) {
          state.chat.messages[idx].content += content;
        }
      }),
    updateToolStatus: (messageId, status, error) =>
      set((state) => {
        const idx = state.chat.messages.findIndex((m) => m.id === messageId);
        if (idx !== -1 && state.chat.messages[idx].tool) {
          state.chat.messages[idx].tool!.status = status;
          if (error) {
            state.chat.messages[idx].tool!.error = error;
          }
        }
      }),
  updateToolInvocation: (messageId, patch) =>
      set((state) => {
        const idx = state.chat.messages.findIndex((m) => m.id === messageId);
        if (idx !== -1 && state.chat.messages[idx].tool) {
          Object.assign(state.chat.messages[idx].tool!, patch);
        }
      }),
    setChatStreaming: (streaming) =>
      set((state) => {
        state.chat.isStreaming = streaming;
      }),
    setChatError: (error) =>
      set((state) => {
        state.chat.error = error;
        state.chat.isStreaming = false;
      }),
    setChatContext: (context) =>
      set((state) => {
        state.chat.lastContext = context;
      }),
    clearChat: () =>
      set((state) => {
        state.chat.messages = [];
        state.chat.error = null;
        state.chat.isStreaming = false;
        state.chat.lastContext = null;
      }),
    startNewConversation: () =>
      set((state) => {
        state.chat.messages = [];
        state.chat.error = null;
        state.chat.isStreaming = false;
        state.chat.lastContext = null;
        state.chat.conversationId = crypto.randomUUID();
      }),

    // UI actions
    setActiveTab: (tab) =>
      set((state) => {
        state.ui.activeTab = tab;
      }),
    setCanvasView: (view) =>
      set((state) => {
        state.ui.canvasView = view;
      }),
    toggleManifest: () =>
      set((state) => {
        state.ui.manifestCollapsed = !state.ui.manifestCollapsed;
      }),
    toggleConsole: () =>
      set((state) => {
        state.ui.consoleCollapsed = !state.ui.consoleCollapsed;
      }),
    showHud: (entity, position) =>
      set((state) => {
        state.ui.hudEntity = entity;
        state.ui.hudPosition = position ?? null;
      }),
    setMode: (mode) =>
      set((state) => {
        state.ui.mode = mode;
      }),
    toggleMode: () =>
      set((state) => {
        state.ui.mode = state.ui.mode === "writer" ? "dm" : "writer";
      }),
    openModal: (modal) =>
      set((state) => {
        state.ui.modal = modal;
      }),
    closeModal: () =>
      set((state) => {
        state.ui.modal = null;
      }),
  }))
);

// Selectors for common queries
export const useCurrentProject = () =>
  useMythosStore((state) => state.project.currentProject);

export const useEntities = () =>
  useMythosStore(
    useShallow((state) => Array.from(state.world.entities.values()))
  );

export const useCharacters = () =>
  useMythosStore(
    useShallow((state) =>
      Array.from(state.world.entities.values()).filter(
        (e) => e.type === "character"
      ) as Character[]
    )
  );

export const useLocations = () =>
  useMythosStore(
    useShallow((state) =>
      Array.from(state.world.entities.values()).filter(
        (e) => e.type === "location"
      ) as Location[]
    )
  );

export const useLinterIssues = () =>
  useMythosStore(useShallow((state) => state.linter.issues));

export const useEditorWordCount = () =>
  useMythosStore((state) => state.editor.wordCount);

export const useEditorInstance = () =>
  useMythosStore((state) => state.editor.editorInstance as Editor | null);

// ============================================================================
// Linter Selectors
// ============================================================================

/**
 * Get issues by severity
 */
export const useLinterIssuesBySeverity = (severity: LinterIssue["severity"]) =>
  useMythosStore(
    useShallow((state) =>
      state.linter.issues.filter((i) => i.severity === severity)
    )
  );

/**
 * Get error issues
 */
export const useLinterErrorIssues = () =>
  useMythosStore(
    useShallow((state) =>
      state.linter.issues.filter((i) => i.severity === "error")
    )
  );

/**
 * Get warning issues
 */
export const useLinterWarningIssues = () =>
  useMythosStore(
    useShallow((state) =>
      state.linter.issues.filter((i) => i.severity === "warning")
    )
  );

/**
 * Get info issues
 */
export const useLinterInfoIssues = () =>
  useMythosStore(
    useShallow((state) =>
      state.linter.issues.filter((i) => i.severity === "info")
    )
  );

/**
 * Get issues by type (character, world, plot, timeline)
 */
export const useLinterIssuesByType = (type: LinterIssue["type"]) =>
  useMythosStore(
    useShallow((state) =>
      state.linter.issues.filter((i) => i.type === type)
    )
  );

/**
 * Get fixable issues
 */
export const useFixableLinterIssues = () =>
  useMythosStore(
    useShallow((state) =>
      state.linter.issues.filter((i) => i.fixable === true)
    )
  );

/**
 * Get issue counts by severity
 */
export const useLinterIssueCounts = () =>
  useMythosStore(
    useShallow((state) => {
      const counts = { error: 0, warning: 0, info: 0, total: 0 };
      state.linter.issues.forEach((issue) => {
        counts[issue.severity]++;
        counts.total++;
      });
      return counts;
    })
  );

/**
 * Get issue counts by type
 */
export const useLinterIssueCountsByType = () =>
  useMythosStore(
    useShallow((state) => {
      const counts = { character: 0, world: 0, plot: 0, timeline: 0 };
      state.linter.issues.forEach((issue) => {
        counts[issue.type]++;
      });
      return counts;
    })
  );

/**
 * Get linting state
 */
export const useIsLinting = () =>
  useMythosStore((state) => state.linter.isRunning);

/**
 * Get linter error
 */
export const useLinterError = () =>
  useMythosStore((state) => state.linter.error);

/**
 * Get selected linter issue
 */
export const useSelectedLinterIssue = () =>
  useMythosStore((state) => {
    if (!state.linter.selectedIssueId) return null;
    return state.linter.issues.find((i) => i.id === state.linter.selectedIssueId) ?? null;
  });

/**
 * Get selected linter issue ID
 */
export const useSelectedLinterIssueId = () =>
  useMythosStore((state) => state.linter.selectedIssueId);

/**
 * Get last linted hash
 */
export const useLastLintedHash = () =>
  useMythosStore((state) => state.linter.lastLintedHash);

/**
 * Get last linted timestamp
 */
export const useLastLintedAt = () =>
  useMythosStore((state) => state.linter.lastRunAt);

/**
 * Get issues grouped by type
 */
export const useLinterIssuesGroupedByType = () =>
  useMythosStore(
    useShallow((state) => {
      const grouped: Record<LinterIssue["type"], LinterIssue[]> = {
        character: [],
        world: [],
        plot: [],
        timeline: [],
      };
      state.linter.issues.forEach((issue) => {
        grouped[issue.type].push(issue);
      });
      return grouped;
    })
  );

/**
 * Get issues grouped by severity
 */
export const useLinterIssuesGroupedBySeverity = () =>
  useMythosStore(
    useShallow((state) => {
      const grouped: Record<LinterIssue["severity"], LinterIssue[]> = {
        error: [],
        warning: [],
        info: [],
      };
      state.linter.issues.forEach((issue) => {
        grouped[issue.severity].push(issue);
      });
      return grouped;
    })
  );

// ============================================================================
// Document Selectors
// ============================================================================

/**
 * Get all documents
 */
export const useDocuments = () =>
  useMythosStore(useShallow((state) => state.document.documents));

/**
 * Get documents by type
 */
export const useDocumentsByType = (type: Document["type"]) =>
  useMythosStore(
    useShallow((state) =>
      state.document.documents.filter((d) => d.type === type)
    )
  );

/**
 * Get chapters (convenience selector)
 */
export const useChapters = () =>
  useMythosStore(
    useShallow((state) =>
      state.document.documents.filter((d) => d.type === "chapter")
    )
  );

/**
 * Get scenes (convenience selector)
 */
export const useScenes = () =>
  useMythosStore(
    useShallow((state) =>
      state.document.documents.filter((d) => d.type === "scene")
    )
  );

// ============================================================================
// Search Selectors
// ============================================================================

/**
 * Get full search state
 */
export const useSearchState = () => useMythosStore((s) => s.search);

/**
 * Get search results
 */
export const useSearchResults = () => useMythosStore((s) => s.search.results);

/**
 * Get search loading state
 */
export const useIsSearching = () => useMythosStore((s) => s.search.isSearching);

/**
 * Get search error
 */
export const useSearchError = () => useMythosStore((s) => s.search.error);

/**
 * Get search query
 */
export const useSearchQuery = () => useMythosStore((s) => s.search.query);

/**
 * Get search mode
 */
export const useSearchMode = () => useMythosStore((s) => s.search.mode);

/**
 * Get search scope
 */
export const useSearchScope = () => useMythosStore((s) => s.search.scope);

/**
 * Get document search hits
 */
export const useDocumentSearchHits = () =>
  useMythosStore(useShallow((s) => s.search.results.documents));

/**
 * Get entity search hits
 */
export const useEntitySearchHits = () =>
  useMythosStore(useShallow((s) => s.search.results.entities));

/**
 * Get total search result count
 */
export const useSearchResultCount = () =>
  useMythosStore(
    (s) => s.search.results.documents.length + s.search.results.entities.length
  );

// ============================================================================
// Chat Selectors
// ============================================================================

/**
 * Get all chat messages
 */
export const useChatMessages = () =>
  useMythosStore(useShallow((s) => s.chat.messages));

/**
 * Get chat streaming state
 */
export const useIsChatStreaming = () =>
  useMythosStore((s) => s.chat.isStreaming);

/**
 * Get chat error
 */
export const useChatError = () =>
  useMythosStore((s) => s.chat.error);

/**
 * Get conversation ID
 */
export const useConversationId = () =>
  useMythosStore((s) => s.chat.conversationId);

/**
 * Get last retrieved RAG context
 */
export const useChatContext = () =>
  useMythosStore((s) => s.chat.lastContext);

/**
 * Get message count
 */
export const useChatMessageCount = () =>
  useMythosStore((s) => s.chat.messages.length);

/**
 * Check if chat has any messages
 */
export const useHasChatMessages = () =>
  useMythosStore((s) => s.chat.messages.length > 0);

// ============================================================================
// UI Selectors
// ============================================================================

/**
 * Get current canvas view (editor or worldGraph)
 */
export const useCanvasView = () =>
  useMythosStore((s) => s.ui.canvasView);

/**
 * Get current modal state
 */
export const useModal = () =>
  useMythosStore((s) => s.ui.modal);

/**
 * Get recent document IDs
 */
export const useRecentDocumentIds = () =>
  useMythosStore(useShallow((s) => s.ui.recent.documentIds));

/**
 * Get recent entity IDs
 */
export const useRecentEntityIds = () =>
  useMythosStore(useShallow((s) => s.ui.recent.entityIds));

/**
 * Get recent documents (resolved from IDs)
 */
export const useRecentDocuments = () =>
  useMythosStore(
    useShallow((s) => {
      const docs = s.document.documents;
      return s.ui.recent.documentIds
        .map((id) => docs.find((d) => d.id === id))
        .filter((d): d is Document => d !== undefined);
    })
  );

/**
 * Get recent entities (resolved from IDs)
 */
export const useRecentEntities = () =>
  useMythosStore(
    useShallow((s) => {
      return s.ui.recent.entityIds
        .map((id) => s.world.entities.get(id))
        .filter((e): e is Entity => e !== undefined);
    })
  );

// Re-export auth store
export { useAuthStore } from "./auth";
export type { AuthState } from "./auth";

// Re-export navigation store
export {
  useNavigationStore,
  useShowProjectSelector,
  useOpenNewProjectModal,
} from "./navigation";

// Re-export memory store
export { useMemoryStore } from "./memory";
export type { MemoryCacheState, ProjectMemoryCache } from "./memory";
