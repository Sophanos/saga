/**
 * @mythos/auth - Centralized Authentication Package
 *
 * Unified authentication for Mythos across all platforms:
 * - Expo (iOS/Android)
 * - Tauri (macOS/Windows)
 * - Web
 *
 * Uses Better Auth with Convex backend.
 */

export * from "./types";
export * from "./config";
export * from "./store";
export { signOutAll } from "./signOutAll";
