/**
 * Convex Auth Configuration
 *
 * Configures authentication with:
 * - GitHub OAuth
 * - Google OAuth
 * - Apple OAuth
 * - Resend Magic Links
 *
 * AUTH DOMAIN: CUSTOM_AUTH_SITE_URL ?? CONVEX_SITE_URL
 * OAuth callbacks MUST go to the same origin that initiates sign-in to
 * ensure PKCE verifiers/cookies are accessible. Using a different domain
 * causes "Invalid verifier" errors.
 *
 * Callback URLs (configure in OAuth provider consoles):
 * - GitHub: https://rhei.team/api/auth/callback/github
 * - Google: https://rhei.team/api/auth/callback/google
 * - Apple: https://rhei.team/api/auth/callback/apple
 *
 * Environment variables:
 * - SITE_URL: Post-auth redirect destination (e.g., https://rhei.team)
 * - CONVEX_SITE_URL: Convex issuer domain (e.g., https://convex.rhei.team)
 * - CUSTOM_AUTH_SITE_URL: Custom auth domain (e.g., https://rhei.team)
 *
 * Custom auth domain requirements:
 * - Ensure the custom domain routes /api/auth/* and /.well-known/* to this Convex deployment
 *
 * Note: AUTH_APPLE_SECRET expires every 6 months. Regenerate with:
 *   node scripts/generate-apple-secret.js
 */

import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import Apple from "@auth/core/providers/apple";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";
import { assertAuthEnv, getAuthEnv } from "./lib/authEnv";

assertAuthEnv();

const { siteUrl, redirectAllowlist } = getAuthEnv();
const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
const allowedRedirectSchemes = new Set(["rhei"]);
const redirectAllowlistWithSite = [normalizedSiteUrl, ...redirectAllowlist].map((value) =>
  value.replace(/\/$/, "")
);

function isAllowedAbsoluteUrl(redirectTo: string): boolean {
  for (const allowed of redirectAllowlistWithSite) {
    if (redirectTo.startsWith(allowed)) {
      const nextChar = redirectTo[allowed.length];
      if (!nextChar || nextChar === "/" || nextChar === "?") {
        return true;
      }
    }
  }
  return false;
}

function isLocalhostUrl(redirectTo: string): boolean {
  try {
    const url = new URL(redirectTo);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function normalizeRedirect(redirectTo: string): string {
  if (redirectTo.startsWith("?") || redirectTo.startsWith("/")) {
    return `${normalizedSiteUrl}${redirectTo}`;
  }

  if (isAllowedAbsoluteUrl(redirectTo)) {
    return redirectTo;
  }

  if (isLocalhostUrl(redirectTo) && isLocalhostUrl(normalizedSiteUrl)) {
    return redirectTo;
  }

  const scheme = new URL(redirectTo).protocol.replace(":", "");
  if (allowedRedirectSchemes.has(scheme)) {
    return redirectTo;
  }

  throw new Error(
    `Invalid redirectTo ${redirectTo} for configured SITE_URL: ${normalizedSiteUrl}`
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub,
    Google,
    Apple({
      profile: (appleInfo) => {
        const name = appleInfo.user
          ? `${appleInfo.user.name.firstName} ${appleInfo.user.name.lastName}`
          : undefined;
        return {
          id: appleInfo.sub,
          name,
          email: appleInfo.email,
        };
      },
    }),
    Resend({
      from: "Rhei <noreply@rhei.team>",
    }),
  ],
  callbacks: {
    redirect: async ({ redirectTo }) => normalizeRedirect(redirectTo),
  },
});
