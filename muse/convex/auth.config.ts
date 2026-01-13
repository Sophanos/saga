/**
 * Convex Auth Configuration
 *
 * Convex Auth issues JWTs signed with `JWT_PRIVATE_KEY` and exposes
 * `/.well-known/jwks.json` at `CONVEX_SITE_URL`. Convex runtime must be told
 * to trust those tokens, otherwise `ctx.auth.getUserIdentity()` will always
 * return null and `useConvexAuth()` stays unauthenticated.
 *
 * Uses OIDC provider config (domain + applicationID) per Convex Auth docs.
 */

import { assertAuthEnv, getAuthEnv } from "./lib/authEnv";

assertAuthEnv();

const { convexSiteUrl } = getAuthEnv();

// The domain must match the JWT issuer (iss claim).
// Convex Auth issues JWTs with issuer = CONVEX_SITE_URL (the backend origin),
// NOT CUSTOM_AUTH_SITE_URL (the proxy domain for OAuth callbacks).
export default {
  providers: [
    {
      domain: convexSiteUrl,
      applicationID: "convex",
    },
  ],
};
