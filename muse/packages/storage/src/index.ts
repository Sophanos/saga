/**
 * @mythos/storage
 * Platform-agnostic storage abstraction layer
 *
 * Usage:
 * - Web: import { webStorage } from "@mythos/storage/web"
 * - Native: import { nativeStorage } from "@mythos/storage/native"
 *
 * Or use the platform detection helper:
 * import { createStorage } from "@mythos/storage"
 */

export type { StorageAdapter } from "./types";
export { STORAGE_PREFIX, createKey } from "./types";

// Re-export platform-specific adapters
export { webStorage } from "./web";
export { nativeStorage } from "./native";

/**
 * Detect platform and return appropriate storage adapter
 * Note: For better tree-shaking, prefer direct imports of web/native
 */
export function createStorage() {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    return import("./web").then((m) => m.webStorage);
  }
  return import("./native").then((m) => m.nativeStorage);
}

/**
 * Helper to create typed storage with JSON serialization
 */
export function createTypedStorage<T>(
  storage: import("./types").StorageAdapter,
  key: string
) {
  return {
    async get(): Promise<T | null> {
      const value = await storage.getItem(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },

    async set(value: T): Promise<void> {
      await storage.setItem(key, JSON.stringify(value));
    },

    async remove(): Promise<void> {
      await storage.removeItem(key);
    },
  };
}
