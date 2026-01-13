/**
 * Convex Auth Client
 *
 * Re-exports Convex Auth hooks for use across platforms.
 */

// Re-export Convex Auth hooks
export { useAuthActions, useAuthToken } from "@convex-dev/auth/react";

// Re-export Convex React auth utilities
export { useConvexAuth, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
