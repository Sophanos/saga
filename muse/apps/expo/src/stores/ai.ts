/**
 * AI Store - State management for AI chat panel
 * Manages threads, messages, model selection, context scope
 */

import { create } from 'zustand';

// Model definitions
export type AIModel = 'auto' | 'claude-sonnet' | 'claude-opus' | 'gemini-flash' | 'gpt-4o';

export const AI_MODELS: Record<AIModel, { label: string; badge?: string; icon: string }> = {
  auto: { label: 'Automatic', icon: 'wand.and.stars' },
  'claude-sonnet': { label: 'Claude Sonnet', badge: 'Fast', icon: 'sparkles' },
  'claude-opus': { label: 'Claude Opus', badge: 'Smart', icon: 'sparkles' },
  'gemini-flash': { label: 'Gemini Flash', icon: 'bolt.fill' },
  'gpt-4o': { label: 'GPT-4o', icon: 'circle.grid.cross' },
};

// Context scope options
export type ContextScope = 'scene' | 'chapter' | 'project' | 'entities' | 'world' | 'notes';

export const CONTEXT_SCOPES: Record<ContextScope, { label: string; icon: string }> = {
  scene: { label: 'Current Scene', icon: 'doc.fill' },
  chapter: { label: 'Current Chapter', icon: 'doc.text.fill' },
  project: { label: 'Entire Project', icon: 'folder.fill' },
  entities: { label: 'All Entities', icon: 'person.3.fill' },
  world: { label: 'World Graph', icon: 'globe' },
  notes: { label: 'Writer Notes', icon: 'note.text' },
};

// Quick action definitions
export type QuickAction =
  | 'search'
  | 'lint'
  | 'continue'
  | 'character'
  | 'brainstorm'
  | 'arc';

export const QUICK_ACTIONS: Record<QuickAction, { label: string; description: string; icon: string; badge?: string }> = {
  search: { label: 'Search your world', description: 'Find anything in your story', icon: 'magnifyingglass' },
  lint: { label: 'Find inconsistencies', description: 'Check for plot holes and errors', icon: 'exclamationmark.triangle' },
  continue: { label: 'Continue this scene', description: 'AI continues your writing', icon: 'pencil.line' },
  character: { label: 'Generate character', description: 'Create a new character', icon: 'person.badge.plus', badge: 'New' },
  brainstorm: { label: 'Brainstorm ideas', description: 'Explore story possibilities', icon: 'lightbulb' },
  arc: { label: 'Analyze story arc', description: 'Review character and plot arcs', icon: 'chart.line.uptrend.xyaxis' },
};

// Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: unknown;
}

// Chat thread
export interface ChatThread {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// Context chip (referenced documents/entities)
export interface ContextChip {
  id: string;
  type: 'document' | 'entity' | 'mention';
  label: string;
  icon?: string;
}

interface AIState {
  // Current thread
  currentThreadId: string | null;
  threads: ChatThread[];

  // Input state
  inputValue: string;
  contextChips: ContextChip[];

  // Settings
  selectedModel: AIModel;
  enabledScopes: ContextScope[];
  webSearchEnabled: boolean;

  // UI state
  isStreaming: boolean;
  showModelSelector: boolean;
  showContextScope: boolean;
  showChatSelector: boolean;

  // Actions
  setInputValue: (value: string) => void;
  addContextChip: (chip: ContextChip) => void;
  removeContextChip: (id: string) => void;
  clearContextChips: () => void;

  setSelectedModel: (model: AIModel) => void;
  toggleScope: (scope: ContextScope) => void;
  setWebSearchEnabled: (enabled: boolean) => void;

  setShowModelSelector: (show: boolean) => void;
  setShowContextScope: (show: boolean) => void;
  setShowChatSelector: (show: boolean) => void;

  // Thread actions
  createThread: (name?: string) => string;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => void;

  // Message actions
  sendMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  // Initial state
  currentThreadId: null,
  threads: [],
  inputValue: '',
  contextChips: [],
  selectedModel: 'auto',
  enabledScopes: ['scene', 'chapter'],
  webSearchEnabled: false,
  isStreaming: false,
  showModelSelector: false,
  showContextScope: false,
  showChatSelector: false,

  // Input actions
  setInputValue: (value) => set({ inputValue: value }),

  addContextChip: (chip) => set((s) => ({
    contextChips: [...s.contextChips.filter(c => c.id !== chip.id), chip]
  })),

  removeContextChip: (id) => set((s) => ({
    contextChips: s.contextChips.filter(c => c.id !== id)
  })),

  clearContextChips: () => set({ contextChips: [] }),

  // Settings actions
  setSelectedModel: (model) => set({ selectedModel: model }),

  toggleScope: (scope) => set((s) => ({
    enabledScopes: s.enabledScopes.includes(scope)
      ? s.enabledScopes.filter(sc => sc !== scope)
      : [...s.enabledScopes, scope]
  })),

  setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),

  // UI actions
  setShowModelSelector: (show) => set({ showModelSelector: show, showContextScope: false, showChatSelector: false }),
  setShowContextScope: (show) => set({ showContextScope: show, showModelSelector: false, showChatSelector: false }),
  setShowChatSelector: (show) => set({ showChatSelector: show, showModelSelector: false, showContextScope: false }),

  // Thread actions
  createThread: (name) => {
    const id = `thread-${Date.now()}`;
    const now = Date.now();
    const thread: ChatThread = {
      id,
      name: name ?? 'New Chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      threads: [thread, ...s.threads],
      currentThreadId: id,
    }));
    return id;
  },

  selectThread: (id) => set({ currentThreadId: id }),

  deleteThread: (id) => set((s) => ({
    threads: s.threads.filter(t => t.id !== id),
    currentThreadId: s.currentThreadId === id ? null : s.currentThreadId,
  })),

  // Message actions
  sendMessage: (content) => {
    const state = get();
    let threadId = state.currentThreadId;

    // Create thread if none exists
    if (!threadId) {
      threadId = get().createThread();
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set((s) => ({
      threads: s.threads.map(t =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, message], updatedAt: Date.now() }
          : t
      ),
      inputValue: '',
      isStreaming: true,
    }));

    // TODO: Send to Convex agent
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
}));

// Selector hooks for convenience
export const useCurrentThread = () => {
  const { currentThreadId, threads } = useAIStore();
  return threads.find(t => t.id === currentThreadId) ?? null;
};

export const useHasMessages = () => {
  const thread = useCurrentThread();
  return (thread?.messages.length ?? 0) > 0;
};
