/**
 * Convex Auth Configuration
 *
 * Configures Convex to validate Better Auth sessions.
 */

import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig;
