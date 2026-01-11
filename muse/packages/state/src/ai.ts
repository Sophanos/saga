/**
 * AI Store - State management for AI chat panel
 * Manages threads, messages, model selection, context scope
 */

import { create } from 'zustand';
import type { ToolCallStatus, QuestionOption } from '@mythos/core';

// Re-export shared types
export type { ToolCallStatus, QuestionOption };

/**
 * UI Model selection - maps to backend model IDs
 * Backend uses OpenRouter IDs like "anthropic/claude-sonnet-4"
 * Frontend uses simplified names for UI
 */
export type AIModel = 'auto' | 'claude-sonnet' | 'claude-opus' | 'gemini-flash' | 'gpt-4o';

export const AI_MODELS: Record<AIModel, { label: string; badge?: string; icon: string; modelId: string }> = {
  auto: { label: 'Automatic', icon: 'wand.and.stars', modelId: 'auto' },
  'claude-sonnet': { label: 'Claude Sonnet', badge: 'Fast', icon: 'sparkles', modelId: 'anthropic/claude-sonnet-4' },
  'claude-opus': { label: 'Claude Opus', badge: 'Smart', icon: 'sparkles', modelId: 'anthropic/claude-opus-4' },
  'gemini-flash': { label: 'Gemini Flash', icon: 'bolt.fill', modelId: 'google/gemini-2.0-flash-001' },
  'gpt-4o': { label: 'GPT-4o', icon: 'circle.grid.cross', modelId: 'openai/gpt-4o' },
};

// Context scope options
export type ContextScope = 'document' | 'collection' | 'project' | 'graph' | 'notes';

type LegacyContextScope = 'scene' | 'chapter' | 'world' | 'entities';

const LEGACY_SCOPE_MAP: Record<LegacyContextScope, ContextScope> = {
  scene: 'document',
  chapter: 'collection',
  world: 'graph',
  entities: 'graph',
};

function normalizeContextScope(scope: ContextScope | LegacyContextScope): ContextScope {
  return LEGACY_SCOPE_MAP[scope as LegacyContextScope] ?? scope;
}

export const CONTEXT_SCOPES: Record<ContextScope, { label: string; icon: string }> = {
  document: { label: 'Current Document', icon: 'doc.fill' },
  collection: { label: 'Current Collection', icon: 'doc.text.fill' },
  project: { label: 'Entire Project', icon: 'folder.fill' },
  graph: { label: 'Project Graph', icon: 'globe' },
  notes: { label: 'Notes', icon: 'note.text' },
};

// Quick action definitions
export type QuickAction =
  | 'search'
  | 'review'
  | 'draft_next'
  | 'create_entity'
  | 'brainstorm'
  | 'analyze_structure'
  | 'clarity_check'
  | 'policy_check';

export const QUICK_ACTIONS: Record<QuickAction, { label: string; description: string; icon: string; badge?: string }> = {
  search: { label: 'Search your project', description: 'Find anything in your project', icon: 'magnifyingglass' },
  review: { label: 'Review for issues', description: 'Check for contradictions and gaps', icon: 'exclamationmark.triangle' },
  draft_next: { label: 'Draft next section', description: 'Continue with a new draft section', icon: 'pencil.line' },
  create_entity: { label: 'Create an entity', description: 'Add a node to the project graph', icon: 'person.badge.plus', badge: 'New' },
  brainstorm: { label: 'Brainstorm ideas', description: 'Explore next steps and options', icon: 'lightbulb' },
  analyze_structure: { label: 'Analyze structure', description: 'Review flow and structure', icon: 'chart.line.uptrend.xyaxis' },
  clarity_check: { label: 'Check clarity', description: 'Find ambiguous pronouns and clichés', icon: 'sparkles' },
  policy_check: { label: 'Check policies', description: 'Verify against pinned style rules', icon: 'shield' },
};

// Tool call in message
export interface MessageToolCall {
  id: string;
  name: string;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
}

// Pending question from AI (extends QuestionOption from core)
export interface PendingQuestion {
  id: string;
  question: string;
  options?: QuestionOption[];
  context?: string;
  allowFreeform?: boolean;
  multiSelect?: boolean;
}

// Message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: MessageToolCall[];
  pendingQuestions?: PendingQuestion[];
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

  // Reset
  reset: () => void;
}

const initialState = {
  currentThreadId: null as string | null,
  threads: [] as ChatThread[],
  inputValue: '',
  contextChips: [] as ContextChip[],
  selectedModel: 'auto' as AIModel,
  enabledScopes: ['document', 'collection'] as ContextScope[],
  webSearchEnabled: false,
  isStreaming: false,
  showModelSelector: false,
  showContextScope: false,
  showChatSelector: false,
};

export const useAIStore = create<AIState>((set, get) => ({
  ...initialState,

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

  toggleScope: (scope) => {
    const normalized = normalizeContextScope(scope as ContextScope | LegacyContextScope);
    set((s) => ({
      enabledScopes: s.enabledScopes.includes(normalized)
        ? s.enabledScopes.filter((sc) => sc !== normalized)
        : [...s.enabledScopes, normalized],
    }));
  },

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
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  reset: () => set(initialState),
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
