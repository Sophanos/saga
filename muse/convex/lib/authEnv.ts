/**
 * Auth Environment Configuration
 *
 * Centralizes parsing and validation of auth-related environment variables.
 * Fail-fast approach: missing or invalid config throws at startup.
 *
 * This prevents silent misconfiguration that leads to:
 * - PKCE "Invalid verifier" errors (domain drift)
 * - "isAuthenticated false" despite server success (JWT issuer mismatch)
 */

export interface AuthEnv {
  /** Post-auth redirect destination (e.g., https://rhei.team) */
  siteUrl: string;
  /** Convex Auth domain for sign-in/callbacks (e.g., https://convex.rhei.team) */
  convexSiteUrl: string;
  /** Optional override for auth domain if different from convexSiteUrl */
  customAuthSiteUrl?: string;
  /** Additional allowed redirect origins for multi-app setups */
  redirectAllowlist: string[];
  /** PEM-encoded private key used to sign Convex Auth JWTs */
  jwtPrivateKey: string;
  /** JSON Web Key Set used by Convex to verify JWTs */
  jwks: string;
  /** Optional override for JWKS fetch URL used by Convex auth config */
  authJwksUrl?: string;
  /** Effective auth domain (customAuthSiteUrl ?? convexSiteUrl) */
  authDomain: string;
}

let cachedEnv: AuthEnv | null = null;

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Get validated auth environment configuration.
 * Throws if required variables are missing.
 *
 * @returns Parsed and validated auth environment
 */
export function getAuthEnv(): AuthEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const siteUrlRaw = process.env["SITE_URL"];
  // For self-hosted Convex, CONVEX_SITE_URL may not be injected by runtime
  // Fallback to CONVEX_SELF_HOSTED_URL or a sensible default
  const convexSiteUrlRaw = process.env["CONVEX_SITE_URL"]
    || process.env["CONVEX_SELF_HOSTED_URL"]
    || "https://convex.rhei.team";
  const customAuthSiteUrlRaw = process.env["CUSTOM_AUTH_SITE_URL"];
  const redirectAllowlistRaw = process.env["AUTH_REDIRECT_ALLOWLIST"];
  const authJwksUrl = process.env["AUTH_JWKS_URL"];
  const jwtPrivateKey = process.env["JWT_PRIVATE_KEY"];
  const jwks = process.env["JWKS"];
  const redirectAllowlist = redirectAllowlistRaw
    ? redirectAllowlistRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => normalizeOrigin(value))
    : [];

  // Validate required vars
  if (!siteUrlRaw) {
    throw new Error(
      "[authEnv] SITE_URL is required. This is the post-auth redirect destination (e.g., https://rhei.team)"
    );
  }

  if (!convexSiteUrlRaw) {
    throw new Error(
      "[authEnv] CONVEX_SITE_URL is required. This is the Convex Auth domain (e.g., https://convex.rhei.team)"
    );
  }

  if (!jwtPrivateKey) {
    throw new Error("[authEnv] JWT_PRIVATE_KEY is required for Convex Auth JWT signing.");
  }

  if (!jwks) {
    throw new Error("[authEnv] JWKS is required for Convex Auth JWT verification.");
  }

  // Validate URL formats
  try {
    new URL(siteUrlRaw);
  } catch {
    throw new Error(`[authEnv] SITE_URL is not a valid URL: ${siteUrlRaw}`);
  }

  try {
    new URL(convexSiteUrlRaw);
  } catch {
    throw new Error(`[authEnv] CONVEX_SITE_URL is not a valid URL: ${convexSiteUrlRaw}`);
  }

  if (customAuthSiteUrlRaw) {
    try {
      new URL(customAuthSiteUrlRaw);
    } catch {
      throw new Error(`[authEnv] CUSTOM_AUTH_SITE_URL is not a valid URL: ${customAuthSiteUrlRaw}`);
    }
  }

  if (authJwksUrl) {
    try {
      new URL(authJwksUrl);
    } catch {
      throw new Error(`[authEnv] AUTH_JWKS_URL is not a valid URL: ${authJwksUrl}`);
    }
  }

  for (const redirectUrl of redirectAllowlist) {
    try {
      new URL(redirectUrl);
    } catch {
      throw new Error(`[authEnv] AUTH_REDIRECT_ALLOWLIST has invalid URL: ${redirectUrl}`);
    }
  }

  try {
    JSON.parse(jwks);
  } catch {
    throw new Error("[authEnv] JWKS must be a valid JSON Web Key Set.");
  }

  // Determine effective auth domain
  const siteUrl = normalizeOrigin(siteUrlRaw);
  const convexSiteUrl = normalizeOrigin(convexSiteUrlRaw);
  const customAuthSiteUrl = customAuthSiteUrlRaw
    ? normalizeOrigin(customAuthSiteUrlRaw)
    : undefined;

  const authDomain = customAuthSiteUrl ?? convexSiteUrl;

  cachedEnv = {
    siteUrl,
    convexSiteUrl,
    customAuthSiteUrl,
    redirectAllowlist,
    jwtPrivateKey,
    jwks,
    authJwksUrl,
    authDomain,
  };

  return cachedEnv;
}

/**
 * Log the current auth environment configuration.
 * Useful for debugging domain drift issues.
 */
export function logAuthEnv(): void {
  try {
    const env = getAuthEnv();
    console.log("[authEnv] Configuration:");
    console.log(`  SITE_URL: ${env.siteUrl}`);
    console.log(`  CONVEX_SITE_URL: ${env.convexSiteUrl}`);
    console.log(`  CUSTOM_AUTH_SITE_URL: ${env.customAuthSiteUrl ?? "(not set)"}`);
    console.log(
      `  AUTH_REDIRECT_ALLOWLIST: ${env.redirectAllowlist.length > 0 ? env.redirectAllowlist.join(", ") : "(not set)"}`
    );
    console.log(`  AUTH_JWKS_URL: ${env.authJwksUrl ?? "(not set)"}`);
    console.log("  JWT_PRIVATE_KEY: (set)");
    console.log("  JWKS: (set)");
    console.log(`  Effective auth domain: ${env.authDomain}`);
    console.log("");
    console.log("  OAuth callback URLs should be:");
    console.log(`    GitHub: ${env.authDomain}/api/auth/callback/github`);
    console.log(`    Google: ${env.authDomain}/api/auth/callback/google`);
    console.log(`    Apple: ${env.authDomain}/api/auth/callback/apple`);
  } catch (error) {
    console.error("[authEnv] Configuration error:", error);
  }
}

/**
 * Assert auth environment is valid.
 * Call this at module load time to fail fast on misconfiguration.
 */
export function assertAuthEnv(): void {
  getAuthEnv(); // Will throw if invalid
}
