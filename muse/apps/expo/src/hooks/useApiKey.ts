/**
 * useApiKey - Expo platform wrapper
 *
 * Configures shared hook with AsyncStorage for React Native.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApiKey as sharedUseApiKey, type ApiKeyStorage } from '@mythos/ai/hooks';

const asyncStorageAdapter: ApiKeyStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export function useApiKey() {
  return sharedUseApiKey({ storage: asyncStorageAdapter });
}

export type { UseApiKeyResult } from '@mythos/ai/hooks';
