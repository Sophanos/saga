/**
 * Centralized API Configuration
 *
 * Single source of truth for timeout values and retry configuration
 * across all API clients. This makes it easy to tune performance
 * and ensures consistency across the codebase.
 */

// =============================================================================
// Timeout Configuration
// =============================================================================

/**
 * API timeout configuration in milliseconds.
 *
 * These values control how long various operations wait before timing out.
 * Tune these based on observed latencies and user experience requirements.
 */
export const API_TIMEOUTS = {
  /** Default timeout for standard API calls (30 seconds) */
  DEFAULT_MS: 30_000,

  /** Initial SSE connection timeout - how long to wait for connection to establish (30 seconds) */
  SSE_CONNECTION_MS: 30_000,

  /** SSE read timeout between chunks - how long to wait for next chunk (60 seconds) */
  SSE_READ_MS: 60_000,

  /** Extended timeout for tool execution which may involve complex operations (2 minutes) */
  TOOL_EXECUTION_MS: 120_000,

  /** Timeout for embedding generation (45 seconds) */
  EMBEDDING_MS: 45_000,

  // ==========================================================================
  // Image Tool Timeouts
  // ==========================================================================

  /** Timeout for image analysis operations (60 seconds) */
  IMAGE_ANALYSIS_MS: 60_000,

  /** Timeout for image generation operations (90 seconds) */
  IMAGE_GENERATION_MS: 90_000,

  /** Timeout for scene illustration operations (120 seconds) */
  SCENE_ILLUSTRATION_MS: 120_000,
} as const;

// =============================================================================
// Retry Configuration
// =============================================================================

/**
 * Retry configuration for API calls with exponential backoff.
 *
 * Used by api-client.ts fetchWithRetry and sagaClient.ts fetchWithRetry.
 * These values control retry behavior for transient failures.
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts (0 = no retries) */
  MAX_RETRIES: 3,

  /** Base delay in milliseconds for exponential backoff */
  BASE_DELAY_MS: 1_000,

  /** Maximum delay cap in milliseconds */
  MAX_DELAY_MS: 10_000,

  /** Multiplier for exponential backoff (delay = baseDelay * multiplier^attempt) */
  BACKOFF_MULTIPLIER: 2,

  /** HTTP status codes that should trigger a retry */
  RETRYABLE_STATUS_CODES: [429, 500, 502, 503, 504] as const,
} as const;

// =============================================================================
// Type Exports
// =============================================================================

/** Type for API timeout keys */
export type ApiTimeoutKey = keyof typeof API_TIMEOUTS;

/** Type for retry config keys */
export type RetryConfigKey = keyof typeof RETRY_CONFIG;
