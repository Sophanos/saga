/**
 * AI Services
 *
 * Client modules for communicating with AI edge functions.
 */

// Re-export base API client for convenience
export { ApiError, callEdgeFunction, type ApiErrorCode, type EdgeFunctionOptions } from "../api-client";

export {
  lintDocumentViaEdge,
  LinterApiError,
  type LintIssue,
  type LintRequestPayload,
  type LintResponsePayload,
  type LintRequestOptions,
  type LinterApiErrorCode,
} from "./linterClient";

export {
  extractDynamicsViaEdge,
  DynamicsApiError,
  type DynamicsRequestPayload,
  type DynamicsResponsePayload,
  type DynamicsRequestOptions,
  type DynamicsApiErrorCode,
} from "./dynamicsClient";

export {
  detectEntitiesViaEdge,
  DetectApiError,
  type DetectRequestPayload,
  type DetectResponsePayload,
  type DetectRequestOptions,
  type DetectApiErrorCode,
} from "./detectClient";

export {
  embedTextViaEdge,
  embedManyViaEdge,
  deleteVectorsViaEdge,
  EmbeddingApiError,
  type EmbedRequestOptions,
  type EmbedTextOptions,
  type SinglePointQdrantOptions,
  type EmbedResponse,
  type QdrantPointMeta,
  type QdrantIndexOptions,
  type EmbeddingApiErrorCode,
} from "./embeddingClient";

export {
  searchViaEdge,
  findSimilarViaEdge,
  SearchApiError,
  type SearchScope,
  type SemanticResult,
  type SearchRequestPayload,
  type SearchResponsePayload,
  type SearchRequestOptions,
  type SearchApiErrorCode,
} from "./searchClient";

export {
  sendChatMessage,
  sendChatMessageStreaming,
  ChatApiError,
  type ChatMessagePayload,
  type ChatRequestPayload,
  type ChatResponsePayload,
  type ChatStreamEvent,
  type ChatStreamEventType,
  type ChatRequestOptions,
  type ChatStreamOptions,
} from "./chatClient";

export {
  sendAgentMessageStreaming,
  AgentApiError,
  type AgentMessagePayload,
  type AgentRequestPayload,
  type AgentStreamEvent,
  type AgentStreamEventType,
  type AgentStreamOptions,
  type ToolCallResult,
  type EditorContext as AgentEditorContext,
} from "./agentClient";

export {
  runGenesisViaEdge,
  GenesisApiError,
  isGenesisApiError,
  type GenesisRequestPayload,
  type GenesisResponsePayload,
  type GeneratedEntity,
  type GenesisRequestOptions,
  type GenesisApiErrorCode,
} from "./genesisClient";
