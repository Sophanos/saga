/**
 * Memory Store for Web App
 *
 * Instantiates the memory cache store using browser localStorage.
 */

import { createMemoryCacheStore } from "@mythos/memory";
import type { StorageAdapter } from "@mythos/storage";

/**
 * Browser localStorage adapter
 */
const browserStorageAdapter: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn("[memory] Failed to save to localStorage:", key);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

/**
 * Memory cache store instance
 */
export const useMemoryStore = createMemoryCacheStore(browserStorageAdapter);

/**
 * Re-export types
 */
export type {
  MemoryCacheState,
  ProjectMemoryCache,
  MemoryCacheStore,
} from "@mythos/memory";
