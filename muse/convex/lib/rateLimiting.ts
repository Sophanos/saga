/**
 * Rate Limiting for Convex Functions
 *
 * Provides in-memory rate limiting for authentication and API endpoints.
 * For production, consider using Redis or Convex's built-in rate limiting.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";

// ============================================================
// Types
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil?: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Block duration after limit exceeded (ms) */
  blockDurationMs?: number;
  /** Identifier prefix for namespacing */
  prefix?: string;
}

// ============================================================
// In-Memory Rate Limiter (for single-instance)
// ============================================================

const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetAt && !entry.blocked) {
      rateLimits.delete(key);
    } else if (entry.blocked && entry.blockedUntil && now > entry.blockedUntil) {
      rateLimits.delete(key);
    }
  }
}

// Clean up every minute
setInterval(cleanupExpiredEntries, 60000);

/**
 * Check rate limit for an identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const key = config.prefix ? `${config.prefix}:${identifier}` : identifier;
  const now = Date.now();

  let entry = rateLimits.get(key);

  // Check if blocked
  if (entry?.blocked) {
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }
    // Block expired, reset
    entry = undefined;
  }

  // Reset if window expired
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
      blocked: false,
    };
    rateLimits.set(key, entry);
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    if (config.blockDurationMs) {
      entry.blocked = true;
      entry.blockedUntil = now + config.blockDurationMs;
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil || entry.resetAt,
      retryAfter: Math.ceil(
        ((entry.blockedUntil || entry.resetAt) - now) / 1000
      ),
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// ============================================================
// Pre-configured Rate Limiters
// ============================================================

/**
 * Rate limit for login attempts
 * 5 attempts per minute, 15 minute block after exceeded
 */
export function checkLoginRateLimit(identifier: string) {
  return checkRateLimit(identifier, {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
    prefix: "login",
  });
}

/**
 * Rate limit for signup attempts
 * 3 attempts per hour, 1 hour block after exceeded
 */
export function checkSignupRateLimit(identifier: string) {
  return checkRateLimit(identifier, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // 1 hour
    prefix: "signup",
  });
}

/**
 * Rate limit for password reset
 * 3 attempts per hour
 */
export function checkPasswordResetRateLimit(identifier: string) {
  return checkRateLimit(identifier, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    prefix: "password-reset",
  });
}

/**
 * Rate limit for API requests (general)
 * 100 requests per minute
 */
export function checkApiRateLimit(identifier: string) {
  return checkRateLimit(identifier, {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    prefix: "api",
  });
}

/**
 * Rate limit for AI requests
 * 20 requests per minute (more restrictive due to cost)
 */
export function checkAiRateLimit(identifier: string) {
  return checkRateLimit(identifier, {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    blockDurationMs: 5 * 60 * 1000, // 5 minute block
    prefix: "ai",
  });
}

/**
 * Rate limit for webhook endpoints
 * 1000 requests per minute (high for batch webhooks)
 */
export function checkWebhookRateLimit(identifier: string) {
  return checkRateLimit(identifier, {
    maxRequests: 1000,
    windowMs: 60 * 1000, // 1 minute
    prefix: "webhook",
  });
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get client identifier from request (IP address or user ID)
 */
export function getClientIdentifier(
  request: Request,
  userId?: string
): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";

  return `ip:${ip}`;
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(
  retryAfter: number
): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
