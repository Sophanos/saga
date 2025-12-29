/**
 * Web Auth Store
 * Instance of the auth store configured for web platform
 */

import { createAuthStore, type AuthState } from "@mythos/state";
import { webStorage } from "@mythos/storage";

// Create the auth store with web storage adapter
export const useAuthStore = createAuthStore(webStorage);

// Re-export types for convenience
export type { AuthState };
