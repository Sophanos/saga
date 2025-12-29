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
