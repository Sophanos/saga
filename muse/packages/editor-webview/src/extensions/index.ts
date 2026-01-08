// AI Suggestion Extensions
export { AIGeneratedMark } from './ai-generated-mark';
export type { AIGeneratedMarkAttributes, SuggestionStatus } from './ai-generated-mark';

export { SuggestionPlugin, suggestionPluginKey, getSuggestionState } from './suggestion-plugin';
export type { Suggestion, SuggestionType, SuggestionPluginState, SuggestionPluginOptions } from './suggestion-plugin';

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
