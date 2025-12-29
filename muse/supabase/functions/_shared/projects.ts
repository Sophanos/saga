/**
 * Project Access Control
 *
 * Enforces project access before operations that bypass RLS (like Qdrant).
 * Since Qdrant has no built-in access control, we must verify project
 * ownership through Supabase before any vector operations.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * Error thrown when project access is denied.
 */
export class ProjectAccessError extends Error {
  constructor(
    message: string,
    public readonly projectId: string,
    public readonly userId: string | null
  ) {
    super(message);
    this.name = "ProjectAccessError";
  }
}

/**
 * Result of project access check.
 */
export interface ProjectAccessResult {
  allowed: boolean;
  project?: {
    id: string;
    name: string;
    userId: string | null;
  };
  error?: string;
}

/**
 * Check if a user has access to a project.
 *
 * Access is granted if:
 * - The project's user_id matches the provided userId
 * - The project's user_id is null (public/unowned project)
 * - The userId is null but project allows anonymous (user_id IS NULL)
 *
 * @param supabase - Supabase client (should be service role)
 * @param projectId - Project ID to check
 * @param userId - User ID to verify access for (null for anonymous)
 */
export async function checkProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null
): Promise<ProjectAccessResult> {
  try {
    // Query project directly (service role bypasses RLS)
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, name, user_id")
      .eq("id", projectId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return {
          allowed: false,
          error: `Project not found: ${projectId}`,
        };
      }
      console.error("[projects] Database error:", error);
      return {
        allowed: false,
        error: "Failed to verify project access",
      };
    }

    if (!project) {
      return {
        allowed: false,
        error: `Project not found: ${projectId}`,
      };
    }

    // Check ownership
    const projectUserId = project.user_id as string | null;

    // Allow if:
    // 1. Project has no owner (null user_id)
    // 2. Project owner matches the requesting user
    if (projectUserId === null || projectUserId === userId) {
      return {
        allowed: true,
        project: {
          id: project.id,
          name: project.name,
          userId: projectUserId,
        },
      };
    }

    // Deny access
    return {
      allowed: false,
      error: "Access denied to this project",
    };
  } catch (error) {
    console.error("[projects] Unexpected error:", error);
    return {
      allowed: false,
      error: "Failed to verify project access",
    };
  }
}

/**
 * Assert that a user has access to a project.
 * Throws ProjectAccessError if access is denied.
 *
 * @param supabase - Supabase client
 * @param projectId - Project ID to check
 * @param userId - User ID to verify access for
 * @throws ProjectAccessError if access is denied
 */
export async function assertProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null
): Promise<void> {
  const result = await checkProjectAccess(supabase, projectId, userId);

  if (!result.allowed) {
    throw new ProjectAccessError(
      result.error ?? "Access denied",
      projectId,
      userId
    );
  }
}

/**
 * Get project with access check.
 * Returns the project if access is allowed, null otherwise.
 *
 * @param supabase - Supabase client
 * @param projectId - Project ID to fetch
 * @param userId - User ID to verify access for
 */
export async function getProjectWithAccess(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null
): Promise<{ id: string; name: string; userId: string | null } | null> {
  const result = await checkProjectAccess(supabase, projectId, userId);
  return result.allowed ? result.project ?? null : null;
}
