/**
 * Progressive state database queries
 * Server-side persistence for progressive disclosure state
 */

import { getSupabaseClient } from "../client";

// ============================================================================
// Types
// ============================================================================

export interface DbProgressiveProjectState {
  id: string;
  project_id: string;
  user_id: string;
  creation_mode: "architect" | "gardener" | "hybrid";
  phase: number;
  unlocked_modules: Record<string, boolean>;
  total_writing_time_sec: number;
  last_entity_nudge_word_count: number | null;
  never_ask: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface DbUserProgressivePreferences {
  id: string;
  user_id: string;
  archetype: "architect" | "gardener" | "hybrid" | null;
  archetype_selected_at: string | null;
  onboarding_completed_at: string | null;
  completed_onboarding_steps: string[];
  current_onboarding_step: string;
  ui_visibility: Record<string, boolean>;
  milestones: Array<{
    id: string;
    type: string;
    label: string;
    description?: string;
    targetValue?: number;
    currentValue: number;
    isComplete: boolean;
    completedAt?: string;
    metadata?: Record<string, unknown>;
  }>;
  created_at: string;
  updated_at: string;
}

export type ProgressiveProjectStateInsert = Omit<
  DbProgressiveProjectState,
  "id" | "created_at" | "updated_at"
>;

export type ProgressiveProjectStateUpdate = Partial<
  Omit<DbProgressiveProjectState, "id" | "project_id" | "user_id" | "created_at" | "updated_at">
>;

export type UserProgressivePreferencesInsert = Omit<
  DbUserProgressivePreferences,
  "id" | "created_at" | "updated_at"
>;

export type UserProgressivePreferencesUpdate = Partial<
  Omit<DbUserProgressivePreferences, "id" | "user_id" | "created_at" | "updated_at">
>;

// ============================================================================
// Project Progressive State Queries
// ============================================================================

/**
 * Get progressive state for a project (for current user)
 */
export async function getProjectProgressiveState(
  projectId: string
): Promise<DbProgressiveProjectState | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_progressive_state" as never)
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error) {
    // PGRST116 = no rows found, which is OK
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }
  return data as DbProgressiveProjectState;
}

/**
 * Get all progressive states for projects the user has access to
 */
export async function getAllProjectProgressiveStates(): Promise<DbProgressiveProjectState[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_progressive_state" as never)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DbProgressiveProjectState[];
}

/**
 * Create or update progressive state for a project
 */
export async function upsertProjectProgressiveState(
  projectId: string,
  state: ProgressiveProjectStateUpdate
): Promise<DbProgressiveProjectState> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("project_progressive_state" as never)
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        ...state,
      } as never,
      { onConflict: "project_id,user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as DbProgressiveProjectState;
}

/**
 * Update specific fields of a project's progressive state
 */
export async function updateProjectProgressiveState(
  projectId: string,
  updates: ProgressiveProjectStateUpdate
): Promise<DbProgressiveProjectState | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("project_progressive_state" as never)
    .update(updates as never)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as DbProgressiveProjectState;
}

/**
 * Delete progressive state for a project
 */
export async function deleteProjectProgressiveState(projectId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("project_progressive_state" as never)
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) throw error;
}

// ============================================================================
// User Progressive Preferences Queries
// ============================================================================

/**
 * Get progressive preferences for current user
 */
export async function getUserProgressivePreferences(): Promise<DbUserProgressivePreferences | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_progressive_preferences" as never)
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as DbUserProgressivePreferences;
}

/**
 * Create or update progressive preferences for current user
 */
export async function upsertUserProgressivePreferences(
  preferences: UserProgressivePreferencesUpdate
): Promise<DbUserProgressivePreferences> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("user_progressive_preferences" as never)
    .upsert(
      {
        user_id: user.id,
        ...preferences,
      } as never,
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as DbUserProgressivePreferences;
}

/**
 * Update specific fields of user progressive preferences
 */
export async function updateUserProgressivePreferences(
  updates: UserProgressivePreferencesUpdate
): Promise<DbUserProgressivePreferences | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("user_progressive_preferences" as never)
    .update(updates as never)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as DbUserProgressivePreferences;
}

/**
 * Delete progressive preferences for current user
 */
export async function deleteUserProgressivePreferences(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("user_progressive_preferences" as never)
    .delete()
    .eq("user_id", user.id);

  if (error) throw error;
}

// ============================================================================
// Sync Helpers
// ============================================================================

/**
 * Sync local progressive state to database
 * Called when user wants to persist their state server-side
 */
export async function syncProgressiveStateToDb(
  projectId: string,
  localState: {
    creationMode: "architect" | "gardener" | "hybrid";
    phase: number;
    unlockedModules: Record<string, boolean>;
    totalWritingTimeSec: number;
    neverAsk: Record<string, boolean>;
    lastEntityNudgeAtWordCount?: number;
  }
): Promise<DbProgressiveProjectState> {
  return upsertProjectProgressiveState(projectId, {
    creation_mode: localState.creationMode,
    phase: localState.phase,
    unlocked_modules: localState.unlockedModules,
    total_writing_time_sec: localState.totalWritingTimeSec,
    never_ask: localState.neverAsk,
    last_entity_nudge_word_count: localState.lastEntityNudgeAtWordCount ?? null,
  });
}

/**
 * Sync user preferences to database
 */
export async function syncUserPreferencesToDb(
  localPreferences: {
    archetype: "architect" | "gardener" | "hybrid" | null;
    archetypeSelectedAt: string | null;
    onboardingCompletedAt: string | null;
    completedOnboardingSteps: string[];
    currentOnboardingStep: string;
    uiVisibility: Record<string, boolean>;
    milestones: Array<{
      id: string;
      type: string;
      label: string;
      description?: string;
      targetValue?: number;
      currentValue: number;
      isComplete: boolean;
      completedAt?: string;
      metadata?: Record<string, unknown>;
    }>;
  }
): Promise<DbUserProgressivePreferences> {
  return upsertUserProgressivePreferences({
    archetype: localPreferences.archetype,
    archetype_selected_at: localPreferences.archetypeSelectedAt,
    onboarding_completed_at: localPreferences.onboardingCompletedAt,
    completed_onboarding_steps: localPreferences.completedOnboardingSteps,
    current_onboarding_step: localPreferences.currentOnboardingStep,
    ui_visibility: localPreferences.uiVisibility,
    milestones: localPreferences.milestones,
  });
}
