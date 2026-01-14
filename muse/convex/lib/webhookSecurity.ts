/**
 * Webhook Security Utilities
 *
 * Provides secure verification for incoming webhooks from:
 * - RevenueCat
 * - Stripe (future)
 * - Other providers
 *
 * Uses Web Crypto API for V8 runtime compatibility
 */

/**
 * RevenueCat webhook verification
 *
 * RevenueCat uses Bearer token authentication for webhooks.
 * The token is configured in the RevenueCat dashboard.
 *
 * @see https://www.revenuecat.com/docs/integrations/webhooks
 */
export async function verifyRevenueCatWebhook(
  authHeader: string | null
): Promise<boolean> {
  if (!authHeader) {
    return false;
  }

  const expectedToken =
    process.env["REVENUECAT_WEBHOOK_SECRET"] ??
    process.env["REVENUECAT_WEBHOOK_AUTH_KEY"];
  if (!expectedToken) {
    console.error(
      "[webhookSecurity] RevenueCat webhook secret not configured"
    );
    return false;
  }

  // RevenueCat uses "Bearer <token>" format
  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(expectedToken, token);
}

/**
 * Stripe webhook signature verification
 *
 * Stripe uses HMAC-SHA256 signatures for webhook verification.
 *
 * @see https://stripe.com/docs/webhooks/signatures
 */
export async function verifyStripeWebhook(
  payload: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[webhookSecurity] STRIPE_WEBHOOK_SECRET not configured");
    return false;
  }

  try {
    // Parse the Stripe signature header
    const elements = signature.split(",");
    const signatureData: Record<string, string> = {};

    for (const element of elements) {
      const [key, value] = element.split("=");
      if (key && value) {
        signatureData[key] = value;
      }
    }

    const timestamp = signatureData["t"];
    const expectedSignature = signatureData["v1"];

    if (!timestamp || !expectedSignature) {
      return false;
    }

    // Check timestamp to prevent replay attacks (5 minute tolerance)
    const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (timestampAge > 300) {
      console.warn("[webhookSecurity] Stripe webhook timestamp too old");
      return false;
    }

    // Compute expected signature using Web Crypto
    const signedPayload = `${timestamp}.${payload}`;
    const computedSignature = await hmacSha256(secret, signedPayload);

    // Constant-time comparison
    return timingSafeEqual(expectedSignature, computedSignature);
  } catch (error) {
    console.error("[webhookSecurity] Stripe verification error:", error);
    return false;
  }
}

/**
 * Generic HMAC webhook verification
 *
 * For providers that use standard HMAC-SHA256 signatures.
 */
export async function verifyHmacWebhook(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    const computedSignature = await hmacSha256(secret, payload);
    return timingSafeEqual(signature, computedSignature);
  } catch {
    return false;
  }
}

/**
 * HMAC-SHA256 using Web Crypto API
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * IP allowlist verification (optional additional security)
 *
 * RevenueCat webhook IPs (as of 2024):
 * - 54.211.85.234
 * - 3.213.116.49
 * - 34.232.59.213
 */
const REVENUECAT_IPS = [
  "54.211.85.234",
  "3.213.116.49",
  "34.232.59.213",
];

export function verifyRevenueCatIP(ip: string | null): boolean {
  if (!ip) return false;

  // Handle X-Forwarded-For format
  const clientIP = ip.split(",")[0]?.trim();
  if (!clientIP) return false;

  return REVENUECAT_IPS.includes(clientIP);
}

/**
 * Rate limiting for webhook endpoints
 *
 * Simple in-memory rate limiter. For production, use Redis.
 */
const webhookRateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkWebhookRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = identifier;

  let record = webhookRateLimits.get(key);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
    webhookRateLimits.set(key, record);
  }

  record.count++;

  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - record.count };
}
