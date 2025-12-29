import type { StorageAdapter } from "./types";
import { createKey, STORAGE_PREFIX } from "./types";

/**
 * Native storage adapter using AsyncStorage
 * Dynamically imports to avoid bundling issues on web
 */

let AsyncStorage: typeof import("@react-native-async-storage/async-storage").default | null = null;

async function getAsyncStorage() {
  if (!AsyncStorage) {
    try {
      const module = await import("@react-native-async-storage/async-storage");
      AsyncStorage = module.default;
    } catch (error) {
      console.error("[Storage] AsyncStorage not available:", error);
      throw new Error("AsyncStorage not available. Make sure @react-native-async-storage/async-storage is installed.");
    }
  }
  return AsyncStorage;
}

export const nativeStorage: StorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const storage = await getAsyncStorage();
      return storage.getItem(createKey(key));
    } catch (error) {
      console.warn(`[Storage] Failed to get item: ${key}`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const storage = await getAsyncStorage();
      await storage.setItem(createKey(key), value);
    } catch (error) {
      console.warn(`[Storage] Failed to set item: ${key}`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const storage = await getAsyncStorage();
      await storage.removeItem(createKey(key));
    } catch (error) {
      console.warn(`[Storage] Failed to remove item: ${key}`, error);
    }
  },

  async getAllKeys(): Promise<string[]> {
    try {
      const storage = await getAsyncStorage();
      const allKeys = await storage.getAllKeys();
      return allKeys
        .filter((key) => key.startsWith(STORAGE_PREFIX))
        .map((key) => key.replace(STORAGE_PREFIX, ""));
    } catch {
      return [];
    }
  },

  async clear(): Promise<void> {
    try {
      const storage = await getAsyncStorage();
      const keys = await this.getAllKeys?.() ?? [];
      await storage.multiRemove(keys.map(createKey));
    } catch (error) {
      console.warn("[Storage] Failed to clear storage", error);
    }
  },

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      const storage = await getAsyncStorage();
      const result = await storage.multiGet(keys.map(createKey));
      return result.map(([key, value]) => [
        key.replace(STORAGE_PREFIX, ""),
        value,
      ]);
    } catch {
      return keys.map((key) => [key, null]);
    }
  },

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    try {
      const storage = await getAsyncStorage();
      await storage.multiSet(
        keyValuePairs.map(([key, value]) => [createKey(key), value])
      );
    } catch (error) {
      console.warn("[Storage] Failed to multiSet", error);
    }
  },
};

export default nativeStorage;
