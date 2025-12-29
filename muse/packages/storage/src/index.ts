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
 * StateStorage interface compatible with zustand persist
 */
export interface StateStorage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

/**
 * Create a zustand-compatible storage adapter
 * Automatically detects platform and returns appropriate storage
 *
 * For web: Uses localStorage (synchronous)
 * For native: Uses AsyncStorage (asynchronous)
 */
export function createStorageAdapter(): StateStorage {
  // Check if we're in a browser environment
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    // Web: Return synchronous localStorage wrapper
    return {
      getItem: (name: string): string | null => {
        try {
          return localStorage.getItem(name);
        } catch {
          console.warn(`[Storage] Failed to get item: ${name}`);
          return null;
        }
      },
      setItem: (name: string, value: string): void => {
        try {
          localStorage.setItem(name, value);
        } catch (error) {
          console.warn(`[Storage] Failed to set item: ${name}`, error);
        }
      },
      removeItem: (name: string): void => {
        try {
          localStorage.removeItem(name);
        } catch {
          console.warn(`[Storage] Failed to remove item: ${name}`);
        }
      },
    };
  }

  // Native: Return AsyncStorage wrapper (lazy loaded)
  let asyncStorageModule: typeof import("@react-native-async-storage/async-storage").default | null = null;

  const getAsyncStorage = async () => {
    if (!asyncStorageModule) {
      try {
        const module = await import("@react-native-async-storage/async-storage");
        asyncStorageModule = module.default;
      } catch (error) {
        console.error("[Storage] AsyncStorage not available:", error);
        throw new Error("AsyncStorage not available");
      }
    }
    return asyncStorageModule;
  };

  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const storage = await getAsyncStorage();
        return storage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const storage = await getAsyncStorage();
        await storage.setItem(name, value);
      } catch (error) {
        console.warn(`[Storage] Failed to set item: ${name}`, error);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        const storage = await getAsyncStorage();
        await storage.removeItem(name);
      } catch {
        console.warn(`[Storage] Failed to remove item: ${name}`);
      }
    },
  };
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
