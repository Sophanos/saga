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

export {
  useSagaAgent,
} from './useSagaAgent';

export type {
  ChatAttachment,
  SagaAgentMessage,
  SagaAgentPlatformAdapter,
  SagaAgentStoreAdapter,
  SagaAgentStreamOptions,
  UseSagaAgentOptions,
  UseSagaAgentResult,
} from './types';
