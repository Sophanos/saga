// Client initialization
export {
  initSupabaseClient,
  getSupabaseClient,
  isSupabaseInitialized,
  resetSupabaseClient,
  createServerClient,
  type SupabaseInitConfig,
  type ServerClientConfig,
  type TypedSupabaseClient,
} from "./client";

// Legacy export for backwards compatibility
// TODO: Remove after all consumers are updated to use getSupabaseClient()
export { supabase } from "./client";

// Types
export type { Database } from "./types/database";

// Queries
export * from "./queries";

// Mappers
export * from "./mappers";
