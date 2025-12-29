/**
 * Mobile Supabase Client Initialization
 *
 * Initializes Supabase for React Native with:
 * - AsyncStorage for session persistence
 * - Disabled URL session detection (not applicable in mobile)
 * - Proper auth configuration for native apps
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nativeStorage } from "@mythos/storage";
import type { Database } from "@mythos/db";

// Singleton client instance
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Supabase client configuration options
 */
export interface MobileSupabaseConfig {
  url: string;
  anonKey: string;
  /** Custom storage adapter (defaults to nativeStorage) */
  storage?: typeof nativeStorage;
  /** Whether to detect session from URL (should be false for mobile) */
  detectSessionInUrl?: boolean;
}

/**
 * Initialize the Supabase client for mobile.
 * Call this early in app startup (e.g., in root _layout.tsx).
 */
export function initMobileSupabase(config?: Partial<MobileSupabaseConfig>): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = config?.url ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = config?.anonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[Supabase] Missing configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  supabaseClient = createClient<Database>(url, anonKey, {
    auth: {
      storage: config?.storage ?? nativeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: config?.detectSessionInUrl ?? false,
    },
  });

  return supabaseClient;
}

/**
 * Get the initialized Supabase client.
 * Throws if initMobileSupabase() hasn't been called yet.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseClient) {
    throw new Error(
      "[Supabase] Client not initialized. Call initMobileSupabase() first."
    );
  }
  return supabaseClient;
}

/**
 * Get the Supabase client, initializing if necessary.
 * Convenience method for most use cases.
 */
export function getMobileSupabase(): SupabaseClient<Database> {
  if (!supabaseClient) {
    return initMobileSupabase();
  }
  return supabaseClient;
}

export type { SupabaseClient, Database };
