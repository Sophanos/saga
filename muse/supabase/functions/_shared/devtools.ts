/**
 * AI SDK DevTools Middleware for Deno/Edge Functions
 *
 * Provides debugging and observability for AI model interactions.
 * Note: The official @ai-sdk/devtools package is Node.js-only due to its
 * WebSocket UI server requirement. This module provides Edge-compatible
 * logging middleware that captures similar debugging information.
 *
 * Enable via environment variable: ENABLE_AI_DEVTOOLS=true
 *
 * Captured data:
 * - Request/response timing
 * - Token usage
 * - Model parameters
 * - Streaming chunks (when enabled)
 * - Error details
 */

// deno-lint-ignore-file no-explicit-any

/**
 * Generic language model interface
 * Supports both V2 and V3 model specifications from AI SDK
 */
interface LanguageModelLike {
  readonly modelId: string;
  readonly provider: string;
  readonly specificationVersion: string;
  doGenerate?: (...args: any[]) => PromiseLike<any>;
  doStream?: (...args: any[]) => PromiseLike<any>;
}

/**
 * Generic call options - uses any to support both V2 and V3 interfaces
 */
type CallOptions = any;

/**
 * Generic stream part - uses any to support both V2 and V3 interfaces
 */
type StreamPart = any;

/**
 * DevTools configuration options
 */
export interface DevToolsConfig {
  /** Enable detailed logging (default: true when devtools enabled) */
  verbose?: boolean;
  /** Log streaming chunks (can be noisy, default: false) */
  logStreamChunks?: boolean;
  /** Custom log prefix for filtering (default: "[ai-devtools]") */
  logPrefix?: string;
  /** Include full prompt in logs (may contain sensitive data, default: false) */
  logPrompts?: boolean;
  /** Maximum prompt length to log when logPrompts is true (default: 500) */
  maxPromptLength?: number;
}

/**
 * DevTools call metadata captured during model invocation
 */
interface DevToolsCallMetadata {
  callId: string;
  modelId: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  finishReason?: string;
  error?: string;
  streamChunkCount?: number;
}

/**
 * Check if DevTools is enabled via environment variable
 */
export function isDevToolsEnabled(): boolean {
  try {
    return Deno.env.get("ENABLE_AI_DEVTOOLS") === "true";
  } catch {
    // Environment access may fail in some contexts
    return false;
  }
}

/**
 * Generate a unique call ID for tracking
 */
function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Truncate text for logging
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + `... [truncated, ${text.length} chars total]`;
}

/**
 * Format messages for logging
 */
function formatMessagesForLog(
  messages: CallOptions["prompt"],
  config: DevToolsConfig
): string {
  if (!config.logPrompts) {
    return `[${messages.length} messages]`;
  }

  const maxLen = config.maxPromptLength ?? 500;
  return messages
    .map((msg: any, i: number) => {
      if (msg.role === "system") {
        return `[${i}] system: ${truncateText(String(msg.content), maxLen)}`;
      }
      if (msg.role === "user") {
        const content = Array.isArray(msg.content)
          ? msg.content.map((p: any) => (p.type === "text" ? p.text : `[${p.type}]`)).join(" ")
          : String(msg.content);
        return `[${i}] user: ${truncateText(content, maxLen)}`;
      }
      if (msg.role === "assistant") {
        const content = Array.isArray(msg.content)
          ? msg.content.map((p: any) => (p.type === "text" ? p.text : `[${p.type}]`)).join(" ")
          : String(msg.content);
        return `[${i}] assistant: ${truncateText(content, maxLen)}`;
      }
      if (msg.role === "tool") {
        return `[${i}] tool: ${truncateText(JSON.stringify(msg.content), maxLen)}`;
      }
      return `[${i}] ${msg.role}: [content]`;
    })
    .join("\n    ");
}

/**
 * Log call start
 */
function logCallStart(
  prefix: string,
  callId: string,
  modelId: string,
  options: CallOptions,
  config: DevToolsConfig
): void {
  // Extract mode from either V2 (mode.type) or V3 format
  const modeType = options?.mode?.type ?? options?.mode ?? "unknown";

  const logLines = [
    `${prefix} === CALL START ===`,
    `  Call ID: ${callId}`,
    `  Model: ${modelId}`,
    `  Mode: ${modeType}`,
  ];

  if (config.verbose) {
    // Handle both V2 (maxTokens) and V3 (maxOutputTokens) naming
    const maxTokens = options?.maxTokens ?? options?.maxOutputTokens ?? "default";
    logLines.push(`  Max Tokens: ${maxTokens}`);
    logLines.push(`  Temperature: ${options?.temperature ?? "default"}`);
    logLines.push(`  Top P: ${options?.topP ?? "default"}`);
    logLines.push(`  Top K: ${options?.topK ?? "default"}`);
    logLines.push(`  Stop Sequences: ${JSON.stringify(options?.stopSequences ?? [])}`);
    if (options?.prompt) {
      logLines.push(`  Messages:\n    ${formatMessagesForLog(options.prompt, config)}`);
    }
  }

  console.log(logLines.join("\n"));
}

/**
 * Log call completion
 */
function logCallComplete(prefix: string, metadata: DevToolsCallMetadata): void {
  const logLines = [
    `${prefix} === CALL COMPLETE ===`,
    `  Call ID: ${metadata.callId}`,
    `  Duration: ${metadata.durationMs}ms`,
    `  Finish Reason: ${metadata.finishReason ?? "unknown"}`,
  ];

  if (metadata.promptTokens !== undefined) {
    logLines.push(`  Prompt Tokens: ${metadata.promptTokens}`);
  }
  if (metadata.completionTokens !== undefined) {
    logLines.push(`  Completion Tokens: ${metadata.completionTokens}`);
  }
  if (metadata.totalTokens !== undefined) {
    logLines.push(`  Total Tokens: ${metadata.totalTokens}`);
  }
  if (metadata.streamChunkCount !== undefined) {
    logLines.push(`  Stream Chunks: ${metadata.streamChunkCount}`);
  }

  console.log(logLines.join("\n"));
}

/**
 * Log call error
 */
function logCallError(prefix: string, callId: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    `${prefix} === CALL ERROR ===\n` +
      `  Call ID: ${callId}\n` +
      `  Error: ${errorMessage}` +
      (errorStack ? `\n  Stack: ${errorStack}` : "")
  );
}

/**
 * Wrap a language model with DevTools middleware for debugging
 *
 * This provides observability similar to @ai-sdk/devtools but works
 * in Deno/Edge environments by logging to console.
 *
 * @param model - The language model to wrap
 * @param config - DevTools configuration options
 * @returns Wrapped model with debugging capabilities
 *
 * @example
 * ```typescript
 * const model = getOpenRouterModel(apiKey, "analysis");
 * const debugModel = wrapWithDevTools(model, { verbose: true });
 * ```
 */
export function wrapWithDevTools<T extends LanguageModelLike>(
  model: T,
  config: DevToolsConfig = {}
): T {
  const prefix = config.logPrefix ?? "[ai-devtools]";
  const verbose = config.verbose ?? true;
  const logStreamChunks = config.logStreamChunks ?? false;

  const effectiveConfig: DevToolsConfig = {
    ...config,
    verbose,
    logStreamChunks,
    logPrefix: prefix,
  };

  // Create a proxy that wraps the model methods
  return new Proxy(model, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // Wrap doGenerate for non-streaming calls
      if (prop === "doGenerate" && typeof value === "function") {
        return async function (
          this: typeof target,
          options: CallOptions
        ) {
          const callId = generateCallId();
          const metadata: DevToolsCallMetadata = {
            callId,
            modelId: target.modelId,
            startTime: Date.now(),
          };

          logCallStart(prefix, callId, target.modelId, options, effectiveConfig);

          try {
            const fn = value as any;
            const result = await fn.call(this, options);

            metadata.endTime = Date.now();
            metadata.durationMs = metadata.endTime - metadata.startTime;
            metadata.finishReason = result.finishReason;
            // Handle both V2 (promptTokens) and V3 (inputTokens) naming
            const usage = result.usage ?? {};
            metadata.promptTokens = usage.promptTokens ?? usage.inputTokens;
            metadata.completionTokens = usage.completionTokens ?? usage.outputTokens;
            metadata.totalTokens =
              (metadata.promptTokens ?? 0) + (metadata.completionTokens ?? 0);

            logCallComplete(prefix, metadata);

            return result;
          } catch (error) {
            metadata.endTime = Date.now();
            metadata.durationMs = metadata.endTime - metadata.startTime;
            metadata.error = error instanceof Error ? error.message : String(error);

            logCallError(prefix, callId, error);
            throw error;
          }
        };
      }

      // Wrap doStream for streaming calls
      if (prop === "doStream" && typeof value === "function") {
        return async function (
          this: typeof target,
          options: CallOptions
        ) {
          const callId = generateCallId();
          const metadata: DevToolsCallMetadata = {
            callId,
            modelId: target.modelId,
            startTime: Date.now(),
            streamChunkCount: 0,
          };

          logCallStart(prefix, callId, target.modelId, options, effectiveConfig);

          try {
            const fn = value as any;
            const result = await fn.call(this, options);

            // Wrap the stream to capture chunks
            const originalStream = result.stream;
            const transformedStream = new TransformStream<
              StreamPart,
              StreamPart
            >({
              transform(chunk, controller) {
                metadata.streamChunkCount = (metadata.streamChunkCount ?? 0) + 1;

                // Handle both V2 (textDelta) and V3 (delta) naming
                if (logStreamChunks && chunk.type === "text-delta") {
                  const text = chunk.textDelta ?? chunk.delta ?? "";
                  console.log(
                    `${prefix} [stream] chunk #${metadata.streamChunkCount}: "${truncateText(text, 100)}"`
                  );
                }

                // Capture finish reason and usage from stream
                if (chunk.type === "finish") {
                  metadata.finishReason = chunk.finishReason;
                  // Handle both V2 (promptTokens) and V3 (inputTokens) naming
                  const usage = chunk.usage ?? {};
                  metadata.promptTokens = usage.promptTokens ?? usage.inputTokens;
                  metadata.completionTokens = usage.completionTokens ?? usage.outputTokens;
                  metadata.totalTokens =
                    (metadata.promptTokens ?? 0) + (metadata.completionTokens ?? 0);
                  metadata.endTime = Date.now();
                  metadata.durationMs = metadata.endTime - metadata.startTime;

                  logCallComplete(prefix, metadata);
                }

                controller.enqueue(chunk);
              },
              flush() {
                // If stream ends without finish chunk, log what we have
                if (!metadata.endTime) {
                  metadata.endTime = Date.now();
                  metadata.durationMs = metadata.endTime - metadata.startTime;
                  console.log(
                    `${prefix} Stream ended (no finish chunk)\n` +
                      `  Call ID: ${callId}\n` +
                      `  Duration: ${metadata.durationMs}ms\n` +
                      `  Chunks: ${metadata.streamChunkCount}`
                  );
                }
              },
            });

            const wrappedStream = originalStream.pipeThrough(transformedStream);

            return {
              ...result,
              stream: wrappedStream,
            };
          } catch (error) {
            metadata.endTime = Date.now();
            metadata.durationMs = metadata.endTime - metadata.startTime;
            metadata.error = error instanceof Error ? error.message : String(error);

            logCallError(prefix, callId, error);
            throw error;
          }
        };
      }

      return value;
    },
  }) as T;
}

/**
 * Conditionally wrap a model with DevTools if enabled
 *
 * Convenience function that checks ENABLE_AI_DEVTOOLS environment variable
 * and only wraps the model if debugging is enabled.
 *
 * @param model - The language model to potentially wrap
 * @param config - DevTools configuration options
 * @returns Original model or wrapped model depending on environment
 *
 * @example
 * ```typescript
 * const model = getOpenRouterModel(apiKey, "analysis");
 * const debuggableModel = maybeWrapWithDevTools(model);
 * ```
 */
export function maybeWrapWithDevTools<T extends LanguageModelLike>(
  model: T,
  config: DevToolsConfig = {}
): T {
  if (!isDevToolsEnabled()) {
    return model;
  }

  console.log(
    `[ai-devtools] DevTools enabled for model: ${model.modelId}\n` +
      `  Provider: ${model.provider}\n` +
      `  Spec Version: ${model.specificationVersion}`
  );

  return wrapWithDevTools(model, config);
}
