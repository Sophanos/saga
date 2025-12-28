import { create } from "zustand";
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
export type ConsoleTab = "chat" | "linter" | "dynamics" | "coach" | "history";

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
  ui: UIState;

  // Project actions
  setCurrentProject: (project: Project | null) => void;
  setProjectLoading: (loading: boolean) => void;
  setProjectError: (error: string | null) => void;

  // Document actions
  setCurrentDocument: (document: Document | null) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;

  // World actions
  addEntity: (entity: Entity) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  removeEntity: (id: string) => void;
  addRelationship: (relationship: Relationship) => void;
  setSelectedEntity: (id: string | null) => void;

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
      tensionLevel: 5,
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
    setSelectedEntity: (id) =>
      set((state) => {
        state.world.selectedEntityId = id;
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
  useMythosStore((state) => Array.from(state.world.entities.values()));

export const useCharacters = () =>
  useMythosStore((state) =>
    Array.from(state.world.entities.values()).filter(
      (e) => e.type === "character"
    ) as Character[]
  );

export const useLocations = () =>
  useMythosStore((state) =>
    Array.from(state.world.entities.values()).filter(
      (e) => e.type === "location"
    ) as Location[]
  );

export const useLinterIssues = () =>
  useMythosStore((state) => state.linter.issues);

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
  useMythosStore((state) =>
    state.linter.issues.filter((i) => i.severity === severity)
  );

/**
 * Get error issues
 */
export const useLinterErrorIssues = () =>
  useMythosStore((state) =>
    state.linter.issues.filter((i) => i.severity === "error")
  );

/**
 * Get warning issues
 */
export const useLinterWarningIssues = () =>
  useMythosStore((state) =>
    state.linter.issues.filter((i) => i.severity === "warning")
  );

/**
 * Get info issues
 */
export const useLinterInfoIssues = () =>
  useMythosStore((state) =>
    state.linter.issues.filter((i) => i.severity === "info")
  );

/**
 * Get issues by type (character, world, plot, timeline)
 */
export const useLinterIssuesByType = (type: LinterIssue["type"]) =>
  useMythosStore((state) =>
    state.linter.issues.filter((i) => i.type === type)
  );

/**
 * Get fixable issues
 */
export const useFixableLinterIssues = () =>
  useMythosStore((state) =>
    state.linter.issues.filter((i) => i.fixable === true)
  );

/**
 * Get issue counts by severity
 */
export const useLinterIssueCounts = () =>
  useMythosStore((state) => {
    const counts = { error: 0, warning: 0, info: 0, total: 0 };
    state.linter.issues.forEach((issue) => {
      counts[issue.severity]++;
      counts.total++;
    });
    return counts;
  });

/**
 * Get issue counts by type
 */
export const useLinterIssueCountsByType = () =>
  useMythosStore((state) => {
    const counts = { character: 0, world: 0, plot: 0, timeline: 0 };
    state.linter.issues.forEach((issue) => {
      counts[issue.type]++;
    });
    return counts;
  });

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
  useMythosStore((state) => {
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
  });

/**
 * Get issues grouped by severity
 */
export const useLinterIssuesGroupedBySeverity = () =>
  useMythosStore((state) => {
    const grouped: Record<LinterIssue["severity"], LinterIssue[]> = {
      error: [],
      warning: [],
      info: [],
    };
    state.linter.issues.forEach((issue) => {
      grouped[issue.severity].push(issue);
    });
    return grouped;
  });

// ============================================================================
// Document Selectors
// ============================================================================

/**
 * Get all documents
 */
export const useDocuments = () =>
  useMythosStore((state) => state.document.documents);

/**
 * Get documents by type
 */
export const useDocumentsByType = (type: Document["type"]) =>
  useMythosStore((state) =>
    state.document.documents.filter((d) => d.type === type)
  );

/**
 * Get chapters (convenience selector)
 */
export const useChapters = () =>
  useMythosStore((state) =>
    state.document.documents.filter((d) => d.type === "chapter")
  );

/**
 * Get scenes (convenience selector)
 */
export const useScenes = () =>
  useMythosStore((state) =>
    state.document.documents.filter((d) => d.type === "scene")
  );
