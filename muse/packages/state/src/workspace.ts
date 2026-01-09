/**
 * Workspace Store - State management for AI-driven workspaces
 * Handles tool call execution, pending questions, and panel control
 */

import { create } from 'zustand';
import type {
  PanelType,
  WorldBuilderTab,
  QuestionOption,
  ToolCallStatus,
} from '@mythos/core';

// Re-export shared types
export type { PanelType, WorldBuilderTab, QuestionOption };

// Tool call types supported by workspace
export type ToolCallType =
  | 'ask_question'
  | 'open_panel'
  | 'focus_entity'
  | 'show_graph'
  | 'create_entity'
  | 'create_relationship'
  | 'analyze_consistency'
  | 'suggest_connections';

// Pending question from AI (workspace-scoped)
export interface WorkspacePendingQuestion {
  id: string;
  question: string;
  options?: QuestionOption[];
  context?: string;
  allowFreeform?: boolean;
  multiSelect?: boolean;
  timestamp: number;
  messageId?: string;
}

// Graph configuration
export interface GraphConfig {
  entities: string[];
  depth: number;
  highlightPath: [string, string] | null;
}

// Tool execution record
export interface WorkspaceToolExecution {
  id: string;
  type: ToolCallType;
  status: ToolCallStatus;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: number;
}

// Tool call payloads
export interface AskQuestionPayload {
  type: 'ask_question';
  id: string;
  question: string;
  options?: QuestionOption[];
  context?: string;
  allowFreeform?: boolean;
  multiSelect?: boolean;
}

export interface OpenPanelPayload {
  type: 'open_panel';
  panel: PanelType;
  params?: {
    entityIds?: string[];
    tab?: string;
    focus?: string;
  };
}

export interface FocusEntityPayload {
  type: 'focus_entity';
  entityId: string;
  highlight?: boolean;
}

export interface ShowGraphPayload {
  type: 'show_graph';
  entities: string[];
  depth?: number;
  highlightPath?: [string, string];
}

export interface CreateEntityPayload {
  type: 'create_entity';
  entity: {
    type: string;
    name: string;
    properties?: Record<string, unknown>;
  };
  askConfirm?: boolean;
}

export interface CreateRelationshipPayload {
  type: 'create_relationship';
  from: string;
  to: string;
  relationType: string;
  bidirectional?: boolean;
}

export type ToolCallPayload =
  | AskQuestionPayload
  | OpenPanelPayload
  | FocusEntityPayload
  | ShowGraphPayload
  | CreateEntityPayload
  | CreateRelationshipPayload;

interface WorkspaceState {
  // Panel Control
  activePanel: PanelType | null;
  panelParams: Record<string, unknown>;
  worldBuilderTab: WorldBuilderTab;

  // Entity Focus
  focusedEntityId: string | null;
  workshopEntities: string[];
  highlightedEntityId: string | null;

  // Pending Questions
  pendingQuestions: WorkspacePendingQuestion[];

  // Graph View
  graphConfig: GraphConfig | null;

  // Tool Executions (for tracking)
  toolExecutions: WorkspaceToolExecution[];

  // Actions - Panel Control
  openPanel: (panel: PanelType, params?: Record<string, unknown>) => void;
  closePanel: () => void;
  setWorldBuilderTab: (tab: WorldBuilderTab) => void;

  // Actions - Entity Focus
  focusEntity: (entityId: string, highlight?: boolean) => void;
  clearFocus: () => void;
  addToWorkshop: (entityId: string) => void;
  removeFromWorkshop: (entityId: string) => void;
  clearWorkshop: () => void;

  // Actions - Questions
  addQuestion: (question: Omit<WorkspacePendingQuestion, 'timestamp'>) => void;
  answerQuestion: (id: string, answer: string | string[]) => void;
  dismissQuestion: (id: string) => void;
  clearQuestions: () => void;

  // Actions - Graph
  showGraph: (config: Omit<GraphConfig, 'highlightPath'> & { highlightPath?: [string, string] }) => void;
  clearGraph: () => void;
  highlightPath: (from: string, to: string) => void;

  // Actions - Tool Execution
  executeToolCall: (tool: ToolCallPayload) => void;
  updateToolExecution: (id: string, update: Partial<WorkspaceToolExecution>) => void;
  clearToolExecutions: () => void;

  // Reset
  reset: () => void;
}

const initialState = {
  activePanel: null as PanelType | null,
  panelParams: {} as Record<string, unknown>,
  worldBuilderTab: 'factions' as WorldBuilderTab,
  focusedEntityId: null as string | null,
  workshopEntities: [] as string[],
  highlightedEntityId: null as string | null,
  pendingQuestions: [] as WorkspacePendingQuestion[],
  graphConfig: null as GraphConfig | null,
  toolExecutions: [] as WorkspaceToolExecution[],
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...initialState,

  // Panel Control
  openPanel: (panel, params = {}) => set({
    activePanel: panel,
    panelParams: params,
  }),

  closePanel: () => set({
    activePanel: null,
    panelParams: {},
  }),

  setWorldBuilderTab: (tab) => set({ worldBuilderTab: tab }),

  // Entity Focus
  focusEntity: (entityId, highlight = false) => set({
    focusedEntityId: entityId,
    highlightedEntityId: highlight ? entityId : null,
  }),

  clearFocus: () => set({
    focusedEntityId: null,
    highlightedEntityId: null,
  }),

  addToWorkshop: (entityId) => set((state) => ({
    workshopEntities: state.workshopEntities.includes(entityId)
      ? state.workshopEntities
      : [...state.workshopEntities, entityId],
  })),

  removeFromWorkshop: (entityId) => set((state) => ({
    workshopEntities: state.workshopEntities.filter(id => id !== entityId),
  })),

  clearWorkshop: () => set({ workshopEntities: [] }),

  // Questions
  addQuestion: (question) => set((state) => ({
    pendingQuestions: [
      ...state.pendingQuestions,
      { ...question, timestamp: Date.now() },
    ],
  })),

  answerQuestion: (id, answer) => {
    const state = get();
    const question = state.pendingQuestions.find(q => q.id === id);

    set({
      pendingQuestions: state.pendingQuestions.filter(q => q.id !== id),
    });

    // Log for now - will be handled by AI integration
    console.log('[Workspace] Question answered:', { id, answer, question });
  },

  dismissQuestion: (id) => set((state) => ({
    pendingQuestions: state.pendingQuestions.filter(q => q.id !== id),
  })),

  clearQuestions: () => set({ pendingQuestions: [] }),

  // Graph
  showGraph: (config) => set({
    graphConfig: {
      entities: config.entities,
      depth: config.depth ?? 1,
      highlightPath: config.highlightPath ?? null,
    },
  }),

  clearGraph: () => set({ graphConfig: null }),

  highlightPath: (from, to) => set((state) => ({
    graphConfig: state.graphConfig
      ? { ...state.graphConfig, highlightPath: [from, to] }
      : null,
  })),

  // Tool Execution
  executeToolCall: (tool) => {
    const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const execution: WorkspaceToolExecution = {
      id,
      type: tool.type as ToolCallType,
      status: 'running',
      params: tool as unknown as Record<string, unknown>,
      timestamp: Date.now(),
    };

    set((state) => ({
      toolExecutions: [...state.toolExecutions, execution],
    }));

    const state = get();

    switch (tool.type) {
      case 'ask_question': {
        const payload = tool as AskQuestionPayload;
        state.addQuestion({
          id: payload.id,
          question: payload.question,
          options: payload.options,
          context: payload.context,
          allowFreeform: payload.allowFreeform,
          multiSelect: payload.multiSelect,
        });
        state.updateToolExecution(id, { status: 'complete' });
        break;
      }

      case 'open_panel': {
        const payload = tool as OpenPanelPayload;
        state.openPanel(payload.panel, payload.params);
        state.updateToolExecution(id, { status: 'complete' });
        break;
      }

      case 'focus_entity': {
        const payload = tool as FocusEntityPayload;
        state.focusEntity(payload.entityId, payload.highlight);
        state.updateToolExecution(id, { status: 'complete' });
        break;
      }

      case 'show_graph': {
        const payload = tool as ShowGraphPayload;
        state.showGraph({
          entities: payload.entities,
          depth: payload.depth ?? 1,
          highlightPath: payload.highlightPath,
        });
        state.updateToolExecution(id, { status: 'complete' });
        break;
      }

      case 'create_entity':
      case 'create_relationship':
        // These are handled by Convex mutations
        console.log('[Workspace] Entity operation:', tool);
        break;

      default:
        console.warn('[Workspace] Unknown tool type:', tool);
        state.updateToolExecution(id, {
          status: 'error',
          error: `Unknown tool type: ${(tool as { type: string }).type}`,
        });
    }
  },

  updateToolExecution: (id, update) => set((state) => ({
    toolExecutions: state.toolExecutions.map(exec =>
      exec.id === id ? { ...exec, ...update } : exec
    ),
  })),

  clearToolExecutions: () => set({ toolExecutions: [] }),

  reset: () => set(initialState),
}));

// Selector hooks
export const usePendingQuestions = () => useWorkspaceStore(state => state.pendingQuestions);
export const useActivePanel = () => useWorkspaceStore(state => state.activePanel);
export const useFocusedEntity = () => useWorkspaceStore(state => state.focusedEntityId);
export const useGraphConfig = () => useWorkspaceStore(state => state.graphConfig);
export const useToolExecutions = () => useWorkspaceStore(state => state.toolExecutions);
