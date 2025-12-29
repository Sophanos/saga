import { getSupabaseClient } from "../client";
import type { ProjectRole } from "@mythos/core";

// Re-export for consumers
export type { ProjectRole } from "@mythos/core";

// Project member types
export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ProjectMemberInsert {
  project_id: string;
  user_id: string;
  role?: ProjectRole;
  invited_by?: string | null;
  invited_at?: string;
  accepted_at?: string | null;
}

export interface ProjectMemberUpdate {
  role?: ProjectRole;
  accepted_at?: string | null;
}

// Extended member with profile info
export interface ProjectMemberWithProfile {
  id: string;
  user_id: string;
  role: ProjectRole;
  invited_at: string;
  accepted_at: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * Get all members of a project
 */
export async function getProjectMembers(
  projectId: string
): Promise<ProjectMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch project members: ${error.message}`);
  }

  return (data as ProjectMember[]) || [];
}

/**
 * Get project members with profile information using RPC
 */
export async function getProjectMembersWithProfiles(
  projectId: string
): Promise<ProjectMemberWithProfile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_project_members", {
    p_project_id: projectId,
  } as never);

  if (error) {
    throw new Error(`Failed to fetch project members: ${error.message}`);
  }

  return (data as ProjectMemberWithProfile[]) || [];
}

/**
 * Get a specific project member
 */
export async function getProjectMember(
  projectId: string,
  userId: string
): Promise<ProjectMember | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch project member: ${error.message}`);
  }

  return data as ProjectMember;
}

/**
 * Get all projects a user is a member of
 */
export async function getUserProjects(userId: string): Promise<ProjectMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .order("accepted_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user projects: ${error.message}`);
  }

  return (data as ProjectMember[]) || [];
}

/**
 * Add a member to a project
 */
export async function addProjectMember(
  member: ProjectMemberInsert
): Promise<ProjectMember> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .insert(member as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add project member: ${error.message}`);
  }

  return data as ProjectMember;
}

/**
 * Update a project member's role
 */
export async function updateProjectMember(
  projectId: string,
  userId: string,
  updates: ProjectMemberUpdate
): Promise<ProjectMember> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .update(updates as never)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update project member: ${error.message}`);
  }

  return data as ProjectMember;
}

/**
 * Remove a member from a project
 */
export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to remove project member: ${error.message}`);
  }
}

/**
 * Check if a user is a member of a project
 */
export async function isProjectMember(
  projectId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("is_project_member", {
    p_project_id: projectId,
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to check project membership: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Check if a user is an editor (or owner) of a project
 */
export async function isProjectEditor(
  projectId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("is_project_editor", {
    p_project_id: projectId,
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to check editor status: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Check if a user is an owner of a project
 */
export async function isProjectOwner(
  projectId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("is_project_owner", {
    p_project_id: projectId,
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to check owner status: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Transfer project ownership to another member
 */
export async function transferProjectOwnership(
  projectId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<void> {
  const supabase = getSupabaseClient();

  // Update the new owner's role to owner
  const { error: updateError } = await supabase
    .from("project_members")
    .update({ role: "owner" } as never)
    .eq("project_id", projectId)
    .eq("user_id", newOwnerId);

  if (updateError) {
    throw new Error(`Failed to transfer ownership: ${updateError.message}`);
  }

  // Demote the current owner to editor
  const { error: demoteError } = await supabase
    .from("project_members")
    .update({ role: "editor" } as never)
    .eq("project_id", projectId)
    .eq("user_id", currentOwnerId);

  if (demoteError) {
    throw new Error(`Failed to demote previous owner: ${demoteError.message}`);
  }
}

/**
 * Get members by role
 */
export async function getProjectMembersByRole(
  projectId: string,
  role: ProjectRole
): Promise<ProjectMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .eq("role", role)
    .not("accepted_at", "is", null);

  if (error) {
    throw new Error(`Failed to fetch members by role: ${error.message}`);
  }

  return (data as ProjectMember[]) || [];
}
