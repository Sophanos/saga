/**
 * Anonymous Session Client
 *
 * Manages anonymous trial sessions for the "try before signup" flow.
 * Stores tokens in cookie + IndexedDB to survive localStorage clears.
 */

import { getSupabaseClient } from "@mythos/db";

// ============================================================================
// Types
// ============================================================================

export interface TrialStatus {
  limit: number;
  used: number;
  remaining: number;
}

export interface AnonSessionResponse {
  anonToken: string;
  deviceId: string;
  trial: TrialStatus;
  isNew: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const COOKIE_NAME = "mythos_anon_token";
const IDB_STORE_NAME = "mythos_anon";
const IDB_KEY = "anon_token";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// ============================================================================
// Cookie Utilities
// ============================================================================

function setCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; max-age=0; path=/`;
}

// ============================================================================
// IndexedDB Utilities
// ============================================================================

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_STORE_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("tokens")) {
        db.createObjectStore("tokens");
      }
    };
  });
}

async function getIDBValue(key: string): Promise<string | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("tokens", "readonly");
      const store = tx.objectStore("tokens");
      const request = store.get(key);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve(request.result ?? null);
      };
    });
  } catch (error) {
    console.warn("[anonymousSession] IDB read failed:", error);
    return null;
  }
}

async function setIDBValue(key: string, value: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("tokens", "readwrite");
      const store = tx.objectStore("tokens");
      const request = store.put(value, key);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  } catch (error) {
    console.warn("[anonymousSession] IDB write failed:", error);
  }
}

async function deleteIDBValue(key: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("tokens", "readwrite");
      const store = tx.objectStore("tokens");
      const request = store.delete(key);

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  } catch (error) {
    console.warn("[anonymousSession] IDB delete failed:", error);
  }
}

// ============================================================================
// Token Storage (Cookie + IndexedDB)
// ============================================================================

/**
 * Store anon token in both cookie and IndexedDB for redundancy
 */
export async function setStoredAnonToken(token: string): Promise<void> {
  setCookie(COOKIE_NAME, token, COOKIE_MAX_AGE);
  await setIDBValue(IDB_KEY, token);
}

/**
 * Get stored anon token (try cookie first, then IndexedDB)
 */
export async function getStoredAnonToken(): Promise<string | null> {
  // Try cookie first (faster)
  const cookieToken = getCookie(COOKIE_NAME);
  if (cookieToken) return cookieToken;

  // Fall back to IndexedDB
  const idbToken = await getIDBValue(IDB_KEY);
  if (idbToken) {
    // Restore to cookie for faster future access
    setCookie(COOKIE_NAME, idbToken, COOKIE_MAX_AGE);
  }
  return idbToken;
}

/**
 * Clear stored anon token from all storages
 */
export async function clearStoredAnonToken(): Promise<void> {
  deleteCookie(COOKIE_NAME);
  await deleteIDBValue(IDB_KEY);
}

/**
 * Get stored token synchronously (cookie only, for headers)
 */
export function getStoredAnonTokenSync(): string | null {
  return getCookie(COOKIE_NAME);
}

// ============================================================================
// Fingerprint Generation
// ============================================================================

/**
 * Generate a coarse fingerprint hash (privacy-preserving)
 * Uses only basic browser properties, no canvas/audio fingerprinting
 */
export async function computeFingerprintHash(): Promise<string> {
  const components: string[] = [];

  // Basic browser info (coarse)
  components.push(navigator.language || "unknown");
  components.push(String(navigator.hardwareConcurrency || 0));
  components.push(String(screen.width || 0));
  components.push(String(screen.height || 0));
  components.push(String(screen.colorDepth || 0));
  components.push(navigator.platform || "unknown");
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown");

  // Hash the combined string
  const data = components.join("|");
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Session Management
// ============================================================================

let sessionPromise: Promise<AnonSessionResponse> | null = null;

/**
 * Ensure an anonymous session exists, creating one if needed
 * Returns the session info with token and trial status
 */
export async function ensureAnonSession(): Promise<AnonSessionResponse> {
  // Avoid concurrent session creation
  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    try {
      const existingToken = await getStoredAnonToken();

      // Generate fingerprint
      const fingerprintHash = await computeFingerprintHash();

      // Call edge function
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<AnonSessionResponse>(
        "anon-session",
        {
          body: { fingerprintHash },
          headers: existingToken ? { "x-anon-token": existingToken } : undefined,
        }
      );

      if (error) {
        console.error("[anonymousSession] Failed to create session:", error);
        throw new Error("Failed to create anonymous session");
      }

      if (!data) {
        throw new Error("No data returned from anon-session");
      }

      // Store the new token
      await setStoredAnonToken(data.anonToken);

      console.log(
        `[anonymousSession] Session ${data.isNew ? "created" : "refreshed"}:`,
        data.deviceId.substring(0, 8),
        `remaining: ${data.trial.remaining}`
      );

      return data;
    } finally {
      sessionPromise = null;
    }
  })();

  return sessionPromise;
}

/**
 * Refresh session and get current trial status
 */
export async function refreshTrialStatus(): Promise<TrialStatus | null> {
  try {
    const session = await ensureAnonSession();
    return session.trial;
  } catch (error) {
    console.error("[anonymousSession] Failed to refresh status:", error);
    return null;
  }
}

/**
 * Check if user has an active anonymous session
 */
export async function hasAnonSession(): Promise<boolean> {
  const token = await getStoredAnonToken();
  return token !== null;
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Get headers to attach to AI requests for anonymous users
 */
export function getAnonHeaders(): Record<string, string> {
  const token = getStoredAnonTokenSync();
  if (token) {
    return { "x-anon-token": token };
  }
  return {};
}

/**
 * Handle anonymous trial errors from AI responses
 * Returns true if the error was an anonymous trial error
 */
export function isAnonTrialError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const errorObj = error as Record<string, unknown>;

  // Check for our custom error codes
  const code = errorObj["code"] as string | undefined;
  const details = errorObj["details"] as Record<string, unknown> | undefined;

  return (
    code === "ANON_SESSION_REQUIRED" ||
    code === "ANON_TRIAL_EXHAUSTED" ||
    code === "ANON_RATE_LIMITED" ||
    details?.["code"] === "ANON_SESSION_REQUIRED" ||
    details?.["code"] === "ANON_TRIAL_EXHAUSTED" ||
    details?.["code"] === "ANON_RATE_LIMITED"
  );
}

/**
 * Check if error indicates trial is exhausted
 */
export function isTrialExhaustedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const errorObj = error as Record<string, unknown>;
  const code = errorObj["code"] as string | undefined;
  const details = errorObj["details"] as Record<string, unknown> | undefined;

  return (
    code === "ANON_TRIAL_EXHAUSTED" ||
    details?.["code"] === "ANON_TRIAL_EXHAUSTED"
  );
}

/**
 * Check if error indicates session is required (needs to call ensureAnonSession)
 */
export function isSessionRequiredError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const errorObj = error as Record<string, unknown>;
  const code = errorObj["code"] as string | undefined;
  const details = errorObj["details"] as Record<string, unknown> | undefined;

  return (
    code === "ANON_SESSION_REQUIRED" ||
    details?.["code"] === "ANON_SESSION_REQUIRED"
  );
}
