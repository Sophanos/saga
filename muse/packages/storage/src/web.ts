import type { StorageAdapter } from "./types";
import { createKey } from "./types";

/**
 * Web storage adapter using localStorage
 */
export const webStorage: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(createKey(key));
    } catch {
      console.warn(`[Storage] Failed to get item: ${key}`);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(createKey(key), value);
    } catch (error) {
      console.warn(`[Storage] Failed to set item: ${key}`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(createKey(key));
    } catch {
      console.warn(`[Storage] Failed to remove item: ${key}`);
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("mythos:")) {
          keys.push(key.replace("mythos:", ""));
        }
      }
      return keys;
    } catch {
      return [];
    }
  },

  async clear(): Promise<void> {
    try {
      const keys = await this.getAllKeys?.() ?? [];
      keys.forEach((key) => localStorage.removeItem(createKey(key)));
    } catch {
      console.warn("[Storage] Failed to clear storage");
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return Promise.all(
      keys.map(async (key) => [key, await this.getItem(key)] as [string, string | null])
    );
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    await Promise.all(keyValuePairs.map(([key, value]) => this.setItem(key, value)));
  },
};

export default webStorage;
