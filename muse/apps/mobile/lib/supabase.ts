import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          genre: string | null;
          user_id: string;
          created_at?: string | null;
          updated_at: string;
        };
      };
      documents: {
        Row: {
          id: string;
          project_id: string;
          title?: string | null;
          content: unknown;
          order_index: number | null;
          created_at?: string | null;
          updated_at: string;
        };
      };
      entities: {
        Row: {
          id: string;
          project_id: string;
          type: string;
          name: string;
          created_at?: string | null;
          updated_at: string;
        };
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
        };
      };
      captures: {
        Row: {
          id: string;
          project_id: string;
          created_by: string;
          kind: string;
          status: string;
          title?: string | null;
          content?: string | null;
          media_url?: string | null;
          media_mime_type?: string | null;
          payload?: Record<string, unknown> | null;
          source?: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

let supabaseClient: SupabaseClient<Database> | null = null;

export function initMobileSupabase(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

export function getMobileSupabase(): SupabaseClient<Database> {
  return supabaseClient ?? initMobileSupabase();
}

