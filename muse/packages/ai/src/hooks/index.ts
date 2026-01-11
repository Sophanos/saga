/**
 * AI Hooks - Shared React hooks for AI functionality
 */

export {
  useApiKey,
  type ApiKeyStorage,
  type UseApiKeyOptions,
  type UseApiKeyResult,
} from './useApiKey';

export {
  useTemplateBuilderAgent,
  type BuilderMessage,
  type BuilderToolInvocation,
  type UseTemplateBuilderAgentOptions,
  type UseTemplateBuilderAgentResult,
} from './useTemplateBuilderAgent';
