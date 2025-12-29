import { getSupabaseClient } from "../client";
import type { ProjectRole } from "./project-members";

// Project invitation types
export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ProjectInvitationInsert {
  project_id: string;
  email: string;
  role?: ProjectRole;
  invited_by?: string | null;
  expires_at?: string;
}

// Extended invitation with inviter info
export interface ProjectInvitationWithInviter {
  id: string;
  email: string;
  role: ProjectRole;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Get all pending invitations for a project
 */
export async function getProjectInvitations(
  projectId: string
): Promise<ProjectInvitation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .select("*")
    .eq("project_id", projectId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch project invitations: ${error.message}`);
  }

  return (data as ProjectInvitation[]) || [];
}

/**
 * Get project invitations with inviter information using RPC
 */
export async function getProjectInvitationsWithInviter(
  projectId: string
): Promise<ProjectInvitationWithInviter[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_project_invitations", {
    p_project_id: projectId,
  } as never);

  if (error) {
    throw new Error(`Failed to fetch project invitations: ${error.message}`);
  }

  return (data as ProjectInvitationWithInviter[]) || [];
}

/**
 * Get an invitation by token
 */
export async function getInvitationByToken(
  token: string
): Promise<ProjectInvitation | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch invitation: ${error.message}`);
  }

  return data as ProjectInvitation;
}

/**
 * Get an invitation by project and email
 */
export async function getInvitationByEmail(
  projectId: string,
  email: string
): Promise<ProjectInvitation | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .select("*")
    .eq("project_id", projectId)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch invitation: ${error.message}`);
  }

  return data as ProjectInvitation;
}

/**
 * Get all pending invitations for an email (for current user)
 */
export async function getInvitationsForEmail(
  email: string
): Promise<ProjectInvitation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .select("*")
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch invitations: ${error.message}`);
  }

  return (data as ProjectInvitation[]) || [];
}

/**
 * Create a new invitation
 */
export async function createInvitation(
  invitation: ProjectInvitationInsert
): Promise<ProjectInvitation> {
  const supabase = getSupabaseClient();
  
  // Get current user ID for invited_by
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from("project_invitations")
    .insert({
      ...invitation,
      invited_by: invitation.invited_by ?? user?.id,
    } as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return data as ProjectInvitation;
}

/**
 * Accept an invitation by token
 */
export async function acceptInvitation(
  token: string
): Promise<{ success: boolean; projectId: string; role: ProjectRole }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    invitation_token: token,
  } as never);

  if (error) {
    throw new Error(`Failed to accept invitation: ${error.message}`);
  }

  const member = data as { project_id: string; role: ProjectRole };
  return {
    success: true,
    projectId: member.project_id,
    role: member.role,
  };
}

/**
 * Revoke/delete an invitation
 */
export async function deleteInvitation(invitationId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("project_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    throw new Error(`Failed to delete invitation: ${error.message}`);
  }
}

/**
 * Delete invitation by project and email
 */
export async function deleteInvitationByEmail(
  projectId: string,
  email: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("project_invitations")
    .delete()
    .eq("project_id", projectId)
    .eq("email", email);

  if (error) {
    throw new Error(`Failed to delete invitation: ${error.message}`);
  }
}

/**
 * Resend an invitation (update expires_at and generate new token)
 */
export async function resendInvitation(
  invitationId: string
): Promise<ProjectInvitation> {
  const supabase = getSupabaseClient();
  
  // Delete old invitation and create new one with same details
  const { data: oldInvite } = await supabase
    .from("project_invitations")
    .select("*")
    .eq("id", invitationId)
    .single();

  if (!oldInvite) {
    throw new Error("Invitation not found");
  }

  // Delete the old invitation
  await supabase
    .from("project_invitations")
    .delete()
    .eq("id", invitationId);

  // Create a new one (will have new token and expiry)
  return createInvitation({
    project_id: (oldInvite as ProjectInvitation).project_id,
    email: (oldInvite as ProjectInvitation).email,
    role: (oldInvite as ProjectInvitation).role,
    invited_by: (oldInvite as ProjectInvitation).invited_by,
  });
}

/**
 * Check if an invitation is valid (not expired, not accepted)
 */
export async function isInvitationValid(token: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .select("id")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    return false;
  }

  return !!data;
}

/**
 * Clean up expired invitations for a project
 */
export async function cleanupExpiredInvitations(projectId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .delete()
    .eq("project_id", projectId)
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    throw new Error(`Failed to cleanup invitations: ${error.message}`);
  }

  return (data || []).length;
}

// ============================================================================
// Edge Function Wrappers
// ============================================================================

/**
 * Invite a project member via the edge function.
 * This sends an invitation email and creates the invitation record.
 */
export async function inviteProjectMember(params: {
  projectId: string;
  email: string;
  role: ProjectRole;
}): Promise<{ invitationId: string; expiresAt: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke("invite-member", {
    body: params,
  });

  if (error) {
    // Try to extract a meaningful error message
    const message = error.message || "Failed to send invitation";
    throw new Error(message);
  }

  // Handle edge function error responses
  if (data?.error) {
    throw new Error(data.error.message || "Failed to send invitation");
  }

  return {
    invitationId: data.invitationId,
    expiresAt: data.expiresAt,
  };
}
