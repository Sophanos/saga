// AI Suggestion Extensions
export { AIGeneratedMark } from './ai-generated-mark';
export type { AIGeneratedMarkAttributes, SuggestionStatus } from './ai-generated-mark';

export { SuggestionPlugin, suggestionPluginKey, getSuggestionState } from './suggestion-plugin';
export type { Suggestion, SuggestionType, SuggestionPluginState, SuggestionPluginOptions } from './suggestion-plugin';

// Block identity
export { BlockIdExtension } from './block-id';
export type { BlockAnchor } from './block-id';

// AI Toolkit (Tiptap-inspired central hub)
export {
  AiToolkitExtension,
  AiToolkit,
  getAiToolkit,
  aiToolkitPluginKey,
  DEFAULT_RULES,
} from './ai-toolkit';
export type {
  AiChange,
  ChangeType,
  AiSuggestionRule,
  ReviewOptions,
  DecorationRenderOptions,
  ToolExecutionResult,
  StreamOptions,
  AiToolkitState,
  AiToolkitOptions,
} from './ai-toolkit';

// Collaboration
export { RemoteCursorExtension, updateRemoteCursors } from './remote-cursor';
export type { RemoteCursorUser } from './remote-cursor';

// Flow Mode Extensions
export {
  FlowFocusExtension,
  flowFocusPluginKey,
  getFlowFocusState,
  updateFlowFocusFromStore,
} from './flow-focus';
export type { FocusLevel, FlowFocusState, FlowFocusOptions } from './flow-focus';

export {
  TypewriterScrollExtension,
  typewriterScrollPluginKey,
  getTypewriterScrollState,
  updateTypewriterScrollFromStore,
} from './typewriter-scroll';
export type { TypewriterScrollState, TypewriterScrollOptions } from './typewriter-scroll';
