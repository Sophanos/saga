/**
 * CORS Headers Helper for Supabase Edge Functions
 *
 * Handles CORS for local development and production environments.
 */

const ALLOWED_ORIGINS = [
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000", // Alternative dev port
  "https://mythos.dev", // Production
  "https://www.mythos.dev", // Production www
];

/**
 * Get CORS headers for a given request origin
 */
export function getCorsHeaders(origin: string | null): Headers {
  const headers = new Headers();

  // Check if origin is allowed
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, apikey, x-openrouter-key, x-client-info"
  );
  headers.set("Access-Control-Max-Age", "86400");

  return headers;
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreFlight(request: Request): Response {
  const origin = request.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Add CORS headers to an existing response
 */
export function withCors(response: Response, origin: string | null): Response {
  const corsHeaders = getCorsHeaders(origin);

  // Clone response with additional headers
  const newHeaders = new Headers(response.headers);
  corsHeaders.forEach((value, key) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Get headers for SSE streaming responses
 */
export function getStreamingHeaders(origin: string | null): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-openrouter-key",
  };
}
