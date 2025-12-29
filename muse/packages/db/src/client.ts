import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types/database";
import type { StorageAdapter } from "@mythos/storage";

/**
 * Configuration for initializing the Supabase client.
 * Platform-agnostic to support both web and mobile.
 */
export type SupabaseInitConfig = {
  /** Supabase project URL */
  url: string;
  /** Supabase anonymous key */
  anonKey: string;
  /** Optional storage adapter for session persistence (web: localStorage, mobile: AsyncStorage) */
  storage?: StorageAdapter;
  /** Whether to detect session from URL (OAuth callback). Default: true for web, false for mobile */
  detectSessionInUrl?: boolean;
  /** Whether to persist the session. Default: true */
  persistSession?: boolean;
  /** Whether to auto-refresh tokens. Default: true */
  autoRefreshToken?: boolean;
};

/**
 * Configuration for server-side Supabase client
 */
export type ServerClientConfig = {
  /** Supabase project URL */
  url: string;
  /** Supabase service role key */
  serviceRoleKey: string;
};

// Singleton client instance
let supabaseClient: SupabaseClient<Database> | null = null;
let clientConfig: SupabaseInitConfig | null = null;

/**
 * Create a storage wrapper that adapts our StorageAdapter to Supabase's expected interface.
 * Supabase expects synchronous getItem but async setItem/removeItem.
 */
function createSupabaseStorageAdapter(storage: StorageAdapter) {
  // Cache for synchronous reads (Supabase requires sync getItem)
  const cache: Map<string, string | null> = new Map();

  return {
    getItem: (key: string): string | null => {
      // Return from cache if available
      if (cache.has(key)) {
        return cache.get(key) ?? null;
      }
      // Trigger async load for next time
      storage.getItem(key).then((value: string | null) => {
        cache.set(key, value);
      });
      return null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      cache.set(key, value);
      await storage.setItem(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
      cache.delete(key);
      await storage.removeItem(key);
    },
  };
}

/**
 * Initialize the Supabase client with platform-specific configuration.
 * Must be called before using getSupabaseClient().
 *
 * @example Web initialization:
 * ```typescript
 * import { webStorage } from "@mythos/storage/web";
 *
 * initSupabaseClient({
 *   url: import.meta.env.VITE_SUPABASE_URL,
 *   anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
 *   storage: webStorage,
 *   detectSessionInUrl: true,
 * });
 * ```
 *
 * @example Mobile initialization:
 * ```typescript
 * import { nativeStorage } from "@mythos/storage/native";
 *
 * initSupabaseClient({
 *   url: Config.SUPABASE_URL,
 *   anonKey: Config.SUPABASE_ANON_KEY,
 *   storage: nativeStorage,
 *   detectSessionInUrl: false,
 * });
 * ```
 */
export function initSupabaseClient(config: SupabaseInitConfig): void {
  if (supabaseClient) {
    console.warn("Supabase client already initialized. Skipping re-initialization.");
    return;
  }

  if (!config.url || !config.anonKey) {
    throw new Error("Supabase URL and anon key are required");
  }

  clientConfig = config;

  const authOptions: {
    persistSession: boolean;
    autoRefreshToken: boolean;
    detectSessionInUrl: boolean;
    storage?: ReturnType<typeof createSupabaseStorageAdapter>;
  } = {
    persistSession: config.persistSession ?? true,
    autoRefreshToken: config.autoRefreshToken ?? true,
    detectSessionInUrl: config.detectSessionInUrl ?? true,
  };

  // Use custom storage adapter if provided
  if (config.storage) {
    authOptions.storage = createSupabaseStorageAdapter(config.storage);
  }

  supabaseClient = createClient<Database>(config.url, config.anonKey, {
    auth: authOptions,
  });
}

/**
 * Get the initialized Supabase client.
 * Throws if initSupabaseClient() has not been called.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    throw new Error(
      "Supabase client not initialized. Call initSupabaseClient() first."
    );
  }
  return supabaseClient;
}

/**
 * Check if the Supabase client has been initialized.
 */
export function isSupabaseInitialized(): boolean {
  return supabaseClient !== null;
}

/**
 * Reset the Supabase client (useful for testing or re-initialization).
 * Warning: This will clear any existing session state.
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
  clientConfig = null;
}

/**
 * Create a server-side Supabase client with service role key.
 * Used for edge functions and server-side operations that need elevated permissions.
 *
 * @param config - Server client configuration with URL and service role key
 * @returns A new Supabase client configured for server-side use
 */
export function createServerClient(config?: ServerClientConfig): SupabaseClient<Database> {
  // Try to use provided config, environment variables, or fall back to stored client config
  const url = config?.url
    ?? (typeof process !== "undefined" ? process.env["SUPABASE_URL"] : undefined)
    ?? clientConfig?.url;

  const serviceRoleKey = config?.serviceRoleKey
    ?? (typeof process !== "undefined" ? process.env["SUPABASE_SERVICE_ROLE_KEY"] : undefined);

  if (!url) {
    throw new Error("Supabase URL is required for server client");
  }

  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set. Server client operations may be restricted.");
    // Fall back to the existing client if available
    if (supabaseClient) {
      return supabaseClient;
    }
    throw new Error("No service role key and no initialized client available");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Legacy export for backwards compatibility during migration
// TODO: Remove after all consumers are updated to use getSupabaseClient()
/**
 * @deprecated Use getSupabaseClient() instead. This will be removed in a future version.
 */
export const supabase: SupabaseClient<Database> | null = null;

// Export types
export type { SupabaseClient };
export type TypedSupabaseClient = SupabaseClient<Database>;
