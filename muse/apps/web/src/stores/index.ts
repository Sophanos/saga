import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import type {
  Entity,
  Character,
  Location,
  Relationship,
  Project,
  Document,
} from "@mythos/core";
import type { ConsistencyIssue } from "@mythos/ai";
import type { Editor } from "@mythos/editor";

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
export type ConsoleTab = "chat" | "search" | "linter" | "dynamics" | "coach" | "history";

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

// UI slice
interface UIState {
  activeTab: ConsoleTab;
  manifestCollapsed: boolean;
  consoleCollapsed: boolean;
  hudEntity: Entity | null; // Entity being shown in ASCII HUD
  hudPosition: { x: number; y: number } | null; // Position for HUD popup
  mode: "writer" | "dm"; // Current editor mode
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

  // UI actions
  setActiveTab: (tab: ConsoleTab) => void;
  toggleManifest: () => void;
  toggleConsole: () => void;
  showHud: (entity: Entity | null, position?: { x: number; y: number }) => void;
  setMode: (mode: "writer" | "dm") => void;
  toggleMode: () => void;
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
    ui: {
      activeTab: "linter",
      manifestCollapsed: false,
      consoleCollapsed: false,
      hudEntity: null,
      hudPosition: null,
      mode: "writer",
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

    // UI actions
    setActiveTab: (tab) =>
      set((state) => {
        state.ui.activeTab = tab;
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

// Re-export auth store
export { useAuthStore } from "./auth";
export type { AuthState } from "./auth";
