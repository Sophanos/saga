/**
 * Platform-agnostic storage interface
 * Implementations for web (localStorage) and native (AsyncStorage)
 */

export interface StorageAdapter {
  /**
   * Get a value from storage
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Set a value in storage
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Remove a value from storage
   */
  removeItem(key: string): Promise<void>;

  /**
   * Get all keys in storage
   */
  getAllKeys?(): Promise<string[]>;

  /**
   * Clear all storage
   */
  clear?(): Promise<void>;

  /**
   * Get multiple values at once
   */
  multiGet?(keys: string[]): Promise<[string, string | null][]>;

  /**
   * Set multiple values at once
   */
  multiSet?(keyValuePairs: [string, string][]): Promise<void>;
}

/**
 * Storage key prefix for namespacing
 */
export const STORAGE_PREFIX = "mythos:";

/**
 * Create a namespaced key
 */
export function createKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}
