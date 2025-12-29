import { getSupabaseClient } from "../client";

// Profile types - will be added to database.ts after migration
export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  preferences?: Record<string, unknown>;
}

export interface ProfileUpdate {
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  preferences?: Record<string, unknown>;
}

/**
 * Get a profile by user ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  return data as Profile;
}

/**
 * Get the current user's profile
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  return getProfile(user.id);
}

/**
 * Get profiles by user IDs (for displaying collaborator info)
 */
export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);

  if (error) {
    throw new Error(`Failed to fetch profiles: ${error.message}`);
  }

  return (data as Profile[]) || [];
}

/**
 * Get a profile by email (for invitation lookup)
 */
export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch profile by email: ${error.message}`);
  }

  return data as Profile;
}

/**
 * Create a profile (usually done via trigger on user signup)
 */
export async function createProfile(profile: ProfileInsert): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert(profile as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create profile: ${error.message}`);
  }

  return data as Profile;
}

/**
 * Update a profile
 */
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data as Profile;
}

/**
 * Update the current user's profile using RPC
 */
export async function updateMyProfile(updates: {
  name?: string;
  avatar_url?: string;
  bio?: string;
  preferences?: Record<string, unknown>;
}): Promise<Profile> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("update_my_profile", {
    new_name: updates.name ?? null,
    new_avatar_url: updates.avatar_url ?? null,
    new_bio: updates.bio ?? null,
    new_preferences: updates.preferences ?? null,
  } as never);

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data as Profile;
}

/**
 * Search profiles by name or email (for user lookup)
 */
export async function searchProfiles(
  query: string,
  limit: number = 10
): Promise<Profile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search profiles: ${error.message}`);
  }

  return (data as Profile[]) || [];
}
