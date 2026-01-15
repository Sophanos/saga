/**
 * Shared Saga agent hook utilities.
 */

export interface ErrorMessageConfig {
  isApiError: (error: unknown) => boolean;
  getErrorCode: (error: unknown) => string | undefined;
  errorPrefix: string;
  errorCodeMessages?: Record<string, string>;
}

const DEFAULT_ERROR_CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Please configure your API key in settings.",
  RATE_LIMITED: "Too many requests. Please wait a moment.",
  ABORTED: "",
};

export function createGetErrorMessage(config: ErrorMessageConfig) {
  const codeMessages = {
    ...DEFAULT_ERROR_CODE_MESSAGES,
    ...config.errorCodeMessages,
  };

  return function getErrorMessage(error: unknown): string {
    if (config.isApiError(error)) {
      const code = config.getErrorCode(error);
      if (code && code in codeMessages) {
        return codeMessages[code];
      }
      if (error instanceof Error) {
        return `${config.errorPrefix}: ${error.message}`;
      }
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return "";
      }
      return `${config.errorPrefix}: ${error.message}`;
    }

    return "An unexpected error occurred.";
  };
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
