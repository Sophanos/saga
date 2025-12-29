import type { ToolExecutionResult } from "../types";

/**
 * Wraps a tool execution function with standardized error handling.
 * Catches any thrown errors and returns a failed result with the error message.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<ToolExecutionResult<T>>
): Promise<ToolExecutionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
