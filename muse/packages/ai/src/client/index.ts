/**
 * AI Client - Shared streaming client for Saga AI
 *
 * Platform-agnostic client used by both web and React Native.
 */

export {
  sendSagaChatStreaming,
  executeGenerateTemplate,
  getErrorMessage,
  SagaApiError,
  type SagaApiErrorCode,
  type SagaChatPayload,
  type SagaStreamOptions,
  type SagaStreamEvent,
  type SagaStreamEventType,
  type ToolCallResult,
  type ToolApprovalRequest,
  type ExecuteToolOptions,
  type StreamContext,
  type ChatMention,
} from './agentClient';

export {
  API_TIMEOUTS,
  RETRY_CONFIG,
  type ApiTimeoutKey,
  type RetryConfigKey,
} from './config';
