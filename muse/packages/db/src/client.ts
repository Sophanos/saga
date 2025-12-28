import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types/database";

// Environment variables (use bracket notation for strict mode)
const supabaseUrl = process.env["SUPABASE_URL"] || process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"] || process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] || "";

// Create typed Supabase client
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Create client for server-side operations (with service role key)
export function createServerClient(): SupabaseClient<Database> {
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set, using anon key");
    return supabase;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Export types
export type { SupabaseClient };
export type TypedSupabaseClient = SupabaseClient<Database>;
