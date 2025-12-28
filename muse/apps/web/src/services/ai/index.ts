/**
 * AI Services
 *
 * Client modules for communicating with AI edge functions.
 */

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
