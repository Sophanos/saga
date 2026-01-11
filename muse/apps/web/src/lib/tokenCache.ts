/**
 * Convex Token Cache
 *
 * TTL-based caching (4 min), in-flight dedup, race-safe updates,
 * retry with backoff, negative cache, auto-invalidation on auth changes.
 */

import { subscribeAuthLifecycle } from "@mythos/auth";

let _authClient: typeof import("./auth").authClient | null = null;

async function getAuthClient() {
  if (!_authClient) {
    const authModule = await import("./auth");
    _authClient = authModule.authClient;
  }
  return _authClient;
}

const TOKEN_TTL_MS = 4 * 60 * 1000;
const NULL_TTL_MS = 15 * 1000;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500;
const MAX_JITTER_MS = 200;

let cachedToken: string | null = null;
let expiresAtMs = 0;
let inFlight: Promise<string | null> | null = null;
let epoch = 0;
const subscribers = new Set<(token: string | null) => void>();

const DEBUG = import.meta.env.DEV;
let fetchCount = 0;

function debugLog(message: string, ...args: unknown[]) {
  if (DEBUG) console.debug(`[tokenCache] ${message}`, ...args);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * MAX_JITTER_MS;
}

function isTransientError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes("fetch");
}

function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

async function fetchTokenWithRetry(): Promise<string | null> {
  let lastError: unknown;
  const authClient = await getAuthClient();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await authClient.$fetch("/api/auth/convex-token", {
        method: "GET",
      });
      const tokenData = response?.data as { token?: string } | undefined;
      return tokenData?.token ?? null;
    } catch (error: unknown) {
      lastError = error;

      const shouldRetry =
        attempt < MAX_RETRIES &&
        (isTransientError(error) ||
          (error instanceof Error &&
            "status" in error &&
            isTransientStatus((error as { status: number }).status)));

      if (shouldRetry) {
        const delay = calculateBackoff(attempt);
        debugLog(`Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
        continue;
      }

      if (
        error instanceof Error &&
        "status" in error &&
        ((error as { status: number }).status === 401 ||
          (error as { status: number }).status === 403)
      ) {
        debugLog("Auth error, returning null");
        return null;
      }

      break;
    }
  }

  debugLog("All retries exhausted", lastError);
  return null;
}

function notifySubscribers(token: string | null) {
  for (const callback of subscribers) {
    try {
      callback(token);
    } catch (error) {
      console.error("[tokenCache] Subscriber error:", error);
    }
  }
}

export async function getConvexToken(): Promise<string | null> {
  const now = Date.now();

  if (now < expiresAtMs) {
    debugLog("Cache hit", { cachedToken: cachedToken ? "[redacted]" : null });
    return cachedToken;
  }

  if (inFlight) {
    debugLog("Joining in-flight request");
    return inFlight;
  }

  const requestEpoch = epoch;
  fetchCount++;
  debugLog(`Starting fetch #${fetchCount}`);

  inFlight = (async () => {
    try {
      const token = await fetchTokenWithRetry();

      if (epoch === requestEpoch) {
        const previousToken = cachedToken;
        cachedToken = token;
        expiresAtMs = now + (token ? TOKEN_TTL_MS : NULL_TTL_MS);

        debugLog("Cache updated", {
          token: token ? "[redacted]" : null,
          expiresIn: expiresAtMs - Date.now(),
          isNegativeCache: !token,
        });

        if (previousToken !== token) {
          notifySubscribers(token);
        }
      } else {
        debugLog("Skipping cache update (epoch mismatch)", {
          requestEpoch,
          currentEpoch: epoch,
        });
      }

      return token;
    } finally {
      if (epoch === requestEpoch) {
        inFlight = null;
      }
    }
  })();

  return inFlight;
}

export function invalidateTokenCache(): void {
  debugLog("Cache invalidated");
  epoch++;
  cachedToken = null;
  expiresAtMs = 0;
  inFlight = null;
  notifySubscribers(null);
}

export function subscribeToTokenChanges(
  callback: (token: string | null) => void
): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

subscribeAuthLifecycle((event) => {
  if (
    event.type === "reset" ||
    event.type === "user_changed" ||
    event.type === "session_changed"
  ) {
    debugLog("Auth lifecycle event, invalidating cache", { type: event.type });
    invalidateTokenCache();
  }
});
