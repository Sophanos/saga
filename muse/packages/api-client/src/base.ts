/**
 * Base API client for Mythos
 * Platform-agnostic HTTP client using fetch
 */

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  data?: never;
  error: {
    message: string;
    code: string;
    status: number;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export class ApiClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    signal?: AbortSignal
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Combine signals if one was provided
    const combinedSignal = signal
      ? this.combineSignals(signal, controller.signal)
      : controller.signal;

    try {
      const response = await fetch(url, {
        ...options,
        signal: combinedSignal,
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
          error: {
            message: errorBody.message || response.statusText,
            code: errorBody.code || "UNKNOWN_ERROR",
            status: response.status,
          },
        };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return {
          error: {
            message: "Request was aborted",
            code: "ABORTED",
            status: 0,
          },
        };
      }

      return {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          code: "NETWORK_ERROR",
          status: 0,
        },
      };
    }
  }

  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return controller.signal;
  }

  async get<T>(endpoint: string, signal?: AbortSignal): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { method: "GET" }, signal);
  }

  async post<T>(
    endpoint: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<ApiResult<T>> {
    return this.request<T>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      signal
    );
  }

  async put<T>(
    endpoint: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<ApiResult<T>> {
    return this.request<T>(
      endpoint,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
      signal
    );
  }

  async delete<T>(endpoint: string, signal?: AbortSignal): Promise<ApiResult<T>> {
    return this.request<T>(endpoint, { method: "DELETE" }, signal);
  }
}
