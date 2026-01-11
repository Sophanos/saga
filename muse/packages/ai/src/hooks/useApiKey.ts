/**
 * useApiKey Hook - Cross-platform API key management
 *
 * Uses a storage adapter pattern to work on both web (localStorage)
 * and React Native (AsyncStorage).
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'mythos-openrouter-key';

/**
 * Storage adapter interface for cross-platform compatibility.
 */
export interface ApiKeyStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

/**
 * Default web storage adapter using localStorage.
 * Falls back to in-memory storage for SSR.
 */
const webStorage: ApiKeyStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};

export interface UseApiKeyOptions {
  storage?: ApiKeyStorage;
}

export interface UseApiKeyResult {
  key: string;
  saveKey: (newKey: string) => Promise<void>;
  clearKey: () => Promise<void>;
  hasKey: boolean;
  isLoading: boolean;
}

/**
 * Hook for managing the OpenRouter API key.
 *
 * @param options - Optional configuration including custom storage adapter
 * @returns API key state and management functions
 *
 * @example
 * // Web (uses localStorage by default)
 * const { key, saveKey, clearKey, hasKey } = useApiKey();
 *
 * @example
 * // React Native with AsyncStorage
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * const { key, saveKey } = useApiKey({ storage: AsyncStorage });
 */
export function useApiKey(options?: UseApiKeyOptions): UseApiKeyResult {
  const storage = options?.storage ?? webStorage;
  const [key, setKeyState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Load key on mount
  useEffect(() => {
    async function loadKey() {
      try {
        const stored = await storage.getItem(STORAGE_KEY);
        setKeyState(stored || '');
      } catch (error) {
        console.warn('[useApiKey] Failed to load key:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadKey();
  }, [storage]);

  // Listen for storage changes on web
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setKeyState(e.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const saveKey = useCallback(
    async (newKey: string) => {
      try {
        await storage.setItem(STORAGE_KEY, newKey);
        setKeyState(newKey);
      } catch (error) {
        console.error('[useApiKey] Failed to save key:', error);
      }
    },
    [storage]
  );

  const clearKey = useCallback(async () => {
    try {
      await storage.removeItem(STORAGE_KEY);
      setKeyState('');
    } catch (error) {
      console.error('[useApiKey] Failed to clear key:', error);
    }
  }, [storage]);

  return {
    key,
    saveKey,
    clearKey,
    hasKey: !!key,
    isLoading,
  };
}
