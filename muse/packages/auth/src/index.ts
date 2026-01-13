/**
 * @mythos/auth - Centralized Authentication Package
 *
 * Unified authentication for Mythos across all platforms:
 * - Expo (iOS/Android)
 * - Tauri (macOS/Windows)
 * - Web
 *
 * Uses Convex Auth with Convex backend.
 */

export * from "./types";
export * from "./config";
export * from "./store";
export { signOutAll } from "./signOutAll";

// Re-export lifecycle subscription for convenience
export { subscribeAuthLifecycle, type AuthLifecycleEvent } from "./store";
