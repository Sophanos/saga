/**
 * Consent Storage Adapters
 *
 * Provides storage abstraction for different platforms:
 * - LocalStorage for web (Tauri, Expo web)
 * - Can be extended for SecureStore (Expo native) if needed
 */

import type { ConsentState, ConsentStorage } from './types';

const STORAGE_KEY = 'mythos_consent_v1';

/**
 * LocalStorage adapter for web platforms
 */
export class LocalStorageConsentStorage implements ConsentStorage {
  async get(): Promise<ConsentState | null> {
    if (typeof localStorage === 'undefined') return null;

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data) as ConsentState;
    } catch {
      return null;
    }
  }

  async set(state: ConsentState): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[Consent] Failed to persist consent state:', error);
    }
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

/**
 * In-memory storage for SSR/testing
 */
export class MemoryConsentStorage implements ConsentStorage {
  private state: ConsentState | null = null;

  async get(): Promise<ConsentState | null> {
    return this.state;
  }

  async set(state: ConsentState): Promise<void> {
    this.state = state;
  }

  async clear(): Promise<void> {
    this.state = null;
  }
}

/**
 * Create the appropriate storage adapter for the current environment
 */
export function createConsentStorage(): ConsentStorage {
  if (typeof localStorage !== 'undefined') {
    return new LocalStorageConsentStorage();
  }
  return new MemoryConsentStorage();
}
