/**
 * Anonymous Session Utilities
 *
 * Provides token signing/verification, hashing, and rate limiting
 * utilities for anonymous trial sessions.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

// ============================================================================
// Types
// ============================================================================

export interface AnonTokenPayload {
  /** Device ID (subject) */
  sub: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** Fingerprint hash (optional) */
  fp?: string;
}

export interface AnonSessionResult {
  deviceId: string;
  isNew: boolean;
  trial: {
    limit: number;
    used: number;
    remaining: number;
  };
}

export interface TrialConsumptionResult {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  resetsAt: Date;
}

// ============================================================================
// Constants
// ============================================================================

/** Token expiration (30 days) */
const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

/** Default trial limit */
const DEFAULT_TRIAL_LIMIT = 5;

/** Rate limit: sessions per IP per hour */
const SESSION_CREATE_LIMIT_PER_HOUR = 10;

/** Rate limit: AI calls per IP per hour */
const AI_CALLS_LIMIT_PER_HOUR = 60;

/** Rate limit: AI calls per device per minute */
const AI_CALLS_LIMIT_PER_MINUTE = 10;

// ============================================================================
// Crypto Utilities
// ============================================================================

let cryptoKey: CryptoKey | null = null;

/**
 * Get or create the HMAC key for JWT signing
 */
async function getSigningKey(): Promise<CryptoKey> {
  if (cryptoKey) return cryptoKey;

  const secret = Deno.env.get("ANON_JWT_SECRET");
  if (!secret) {
    throw new Error("ANON_JWT_SECRET environment variable is required");
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  return cryptoKey;
}

/**
 * Compute HMAC-SHA256 hash of a string
 */
async function hmacHash(data: string): Promise<string> {
  const secret = Deno.env.get("ANON_JWT_SECRET") ?? "default-salt";
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// Token Operations
// ============================================================================

/**
 * Create a signed anonymous session token
 */
export async function createAnonToken(
  deviceId: string,
  fingerprintHash?: string
): Promise<string> {
  const key = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);

  const payload: AnonTokenPayload = {
    sub: deviceId,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
    ...(fingerprintHash && { fp: fingerprintHash }),
  };

  return await create({ alg: "HS256", typ: "JWT" }, payload, key);
}

/**
 * Verify and decode an anonymous session token
 */
export async function verifyAnonToken(
  token: string
): Promise<AnonTokenPayload | null> {
  try {
    const key = await getSigningKey();
    const payload = await verify(token, key) as AnonTokenPayload;

    // Validate required fields
    if (!payload.sub || !payload.exp) {
      console.warn("[anonymous] Token missing required fields");
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.warn("[anonymous] Token expired");
      return null;
    }

    return payload;
  } catch (error) {
    console.warn("[anonymous] Token verification failed:", error);
    return null;
  }
}

/**
 * Extract device ID from token header
 */
export async function getDeviceIdFromRequest(
  request: Request
): Promise<string | null> {
  const token = request.headers.get("x-anon-token");
  if (!token) return null;

  const payload = await verifyAnonToken(token);
  return payload?.sub ?? null;
}

// ============================================================================
// Hashing Utilities
// ============================================================================

/**
 * Extract and hash IP prefix (privacy-preserving)
 * For IPv4: uses /24 prefix (first 3 octets)
 * For IPv6: uses /48 prefix
 */
export async function hashIpPrefix(request: Request): Promise<string> {
  // Try various headers for the client IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown";

  let prefix: string;

  if (ip.includes(":")) {
    // IPv6: take first 3 segments (roughly /48)
    prefix = ip.split(":").slice(0, 3).join(":");
  } else {
    // IPv4: take first 3 octets (/24)
    prefix = ip.split(".").slice(0, 3).join(".");
  }

  return await hmacHash(`ip:${prefix}`);
}

/**
 * Hash User-Agent (privacy-preserving)
 */
export async function hashUserAgent(request: Request): Promise<string | null> {
  const ua = request.headers.get("user-agent");
  if (!ua) return null;

  // Use a coarse version (just browser family + OS)
  const coarseUA = ua.substring(0, 100); // Truncate for consistency
  return await hmacHash(`ua:${coarseUA}`);
}

// ============================================================================
// Session Registration
// ============================================================================

/**
 * Register or reuse an anonymous device session
 */
export async function registerAnonSession(
  supabase: SupabaseClient,
  request: Request,
  fingerprintHash?: string
): Promise<AnonSessionResult> {
  const ipHash = await hashIpPrefix(request);
  const uaHash = await hashUserAgent(request);

  const { data, error } = await supabase.rpc("register_anon_device", {
    p_fingerprint_hash: fingerprintHash ?? null,
    p_ip_prefix_hash: ipHash,
    p_user_agent_hash: uaHash,
  });

  if (error) {
    console.error("[anonymous] Failed to register device:", error);
    throw new Error("Failed to create anonymous session");
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("No data returned from register_anon_device");
  }

  return {
    deviceId: row.device_id,
    isNew: row.is_new,
    trial: {
      limit: row.trial_limit ?? DEFAULT_TRIAL_LIMIT,
      used: row.requests_used ?? 0,
      remaining: row.remaining ?? DEFAULT_TRIAL_LIMIT,
    },
  };
}

// ============================================================================
// Quota Enforcement
// ============================================================================

/**
 * Consume one anonymous trial request
 * Returns false if quota exhausted
 */
export async function consumeTrialRequest(
  supabase: SupabaseClient,
  deviceId: string
): Promise<TrialConsumptionResult> {
  const { data, error } = await supabase.rpc("consume_anon_trial_request", {
    p_device_id: deviceId,
  });

  if (error) {
    console.error("[anonymous] Failed to consume trial request:", error);
    throw new Error("Failed to check trial quota");
  }

  const row = data?.[0];
  if (!row) {
    return {
      allowed: false,
      used: 0,
      remaining: 0,
      limit: 0,
    };
  }

  return {
    allowed: row.allowed,
    used: row.used,
    remaining: row.remaining,
    limit: row.trial_limit,
  };
}

/**
 * Get trial status without consuming
 */
export async function getTrialStatus(
  supabase: SupabaseClient,
  deviceId: string
): Promise<TrialConsumptionResult | null> {
  const { data, error } = await supabase.rpc("get_anon_trial_status", {
    p_device_id: deviceId,
  });

  if (error) {
    console.error("[anonymous] Failed to get trial status:", error);
    return null;
  }

  const row = data?.[0];
  if (!row || !row.is_valid) {
    return null;
  }

  return {
    allowed: !row.is_blocked && row.remaining > 0,
    used: row.requests_used,
    remaining: row.remaining,
    limit: row.trial_limit,
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check rate limit for an action
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  windowSeconds: number,
  limit: number
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket_key: bucketKey,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });

  if (error) {
    console.error("[anonymous] Rate limit check failed:", error);
    // Fail open but log the error
    return {
      allowed: true,
      currentCount: 0,
      resetsAt: new Date(),
    };
  }

  const row = data?.[0];
  return {
    allowed: row?.allowed ?? true,
    currentCount: row?.current_count ?? 0,
    resetsAt: new Date(row?.resets_at ?? Date.now()),
  };
}

/**
 * Check session creation rate limit (per IP)
 */
export async function checkSessionCreateLimit(
  supabase: SupabaseClient,
  request: Request
): Promise<RateLimitResult> {
  const ipHash = await hashIpPrefix(request);
  return checkRateLimit(
    supabase,
    `ip:${ipHash}:session_create`,
    3600, // 1 hour window
    SESSION_CREATE_LIMIT_PER_HOUR
  );
}

/**
 * Check AI call rate limit (per IP)
 */
export async function checkAICallLimitByIP(
  supabase: SupabaseClient,
  request: Request
): Promise<RateLimitResult> {
  const ipHash = await hashIpPrefix(request);
  return checkRateLimit(
    supabase,
    `ip:${ipHash}:ai_call`,
    3600, // 1 hour window
    AI_CALLS_LIMIT_PER_HOUR
  );
}

/**
 * Check AI call rate limit (per device, short window)
 */
export async function checkAICallLimitByDevice(
  supabase: SupabaseClient,
  deviceId: string
): Promise<RateLimitResult> {
  return checkRateLimit(
    supabase,
    `device:${deviceId}:ai_call`,
    60, // 1 minute window
    AI_CALLS_LIMIT_PER_MINUTE
  );
}

// ============================================================================
// Error Codes
// ============================================================================

export enum AnonErrorCode {
  SESSION_REQUIRED = "ANON_SESSION_REQUIRED",
  TRIAL_EXHAUSTED = "ANON_TRIAL_EXHAUSTED",
  RATE_LIMITED = "ANON_RATE_LIMITED",
  DEVICE_BLOCKED = "ANON_DEVICE_BLOCKED",
}

/**
 * Check if an error code is an anonymous-specific error
 */
export function isAnonError(code: string): code is AnonErrorCode {
  return Object.values(AnonErrorCode).includes(code as AnonErrorCode);
}
