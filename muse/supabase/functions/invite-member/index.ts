/**
 * Invite Member Edge Function
 *
 * POST /invite-member
 *
 * Creates an invitation and sends an email to the invitee.
 * Requires an authenticated user with editor+ role on the project.
 *
 * Request Body:
 * {
 *   projectId: string,
 *   email: string,
 *   role: "editor" | "viewer"
 * }
 *
 * Response:
 * {
 *   invitationId: string,
 *   expiresAt: string
 * }
 *
 * Environment Variables:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anon key for auth verification
 * - RESEND_API_KEY: Resend API key for sending emails
 * - INVITE_FROM_EMAIL: Email address to send invitations from
 * - APP_URL: Application URL for invite links
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  ErrorCode,
  validateRequestBody,
} from "../_shared/errors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

// ============================================================================
// Types
// ============================================================================

interface InviteMemberRequest {
  projectId: string;
  email: string;
  role: "editor" | "viewer";
}

interface InviteMemberResponse {
  invitationId: string;
  expiresAt: string;
  emailSent: boolean;
}

// ============================================================================
// Email Sending (Resend)
// ============================================================================

async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  projectName: string;
  role: string;
  inviteUrl: string;
}): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("INVITE_FROM_EMAIL") ?? "Mythos <noreply@mythos.dev>";

  if (!resendApiKey) {
    console.warn("[invite-member] RESEND_API_KEY not configured, skipping email");
    return false;
  }

  const roleLabel = params.role === "editor" ? "Editor" : "Viewer";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: fromEmail,
        to: [params.to],
        subject: `${params.inviterName} invited you to collaborate on "${params.projectName}"`,
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a; margin-bottom: 16px;">You've been invited to collaborate!</h2>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
              <strong>${params.inviterName}</strong> has invited you to join
              <strong>"${params.projectName}"</strong> as a <strong>${roleLabel}</strong>.
            </p>
            <div style="margin: 32px 0;">
              <a href="${params.inviteUrl}"
                 style="background-color: #0ea5e9; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 6px; font-weight: 500;
                        display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #6a6a6a; font-size: 14px;">
              This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
            <p style="color: #9a9a9a; font-size: 12px;">
              Sent from <a href="https://mythos.dev" style="color: #0ea5e9;">Mythos</a>
            </p>
          </div>
        `,
        text: `
${params.inviterName} has invited you to collaborate on "${params.projectName}" as a ${roleLabel}.

Accept the invitation: ${params.inviteUrl}

This invitation expires in 7 days.
        `.trim(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[invite-member] Failed to send email:", errorText);
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[invite-member] Email request timed out after 10 seconds");
    } else {
      console.error("[invite-member] Failed to send email:", error);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.BAD_REQUEST,
      "Method not allowed. Use POST.",
      origin
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader ?? "" },
      },
    });

    // Authenticate user
    const user = await getAuthenticatedUser(supabase, authHeader);

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        "Invalid JSON in request body",
        origin
      );
    }

    // Validate required fields
    const validation = validateRequestBody(body, ["projectId", "email", "role"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as InviteMemberRequest;

    // Validate role
    if (!["editor", "viewer"].includes(request.role)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid role. Must be 'editor' or 'viewer'.",
        origin
      );
    }

    // Validate email format
    // NOTE: Canonical email validation is in @mythos/core (packages/core/src/utils/validation.ts)
    // Edge functions cannot import from @mythos/core, so this is a local copy.
    // Keep in sync with: isValidEmail() and EMAIL_REGEX in @mythos/core
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid email address format.",
        origin
      );
    }

    // Check if user is an editor of the project
    const { data: isEditor, error: authzError } = await supabase.rpc(
      "is_project_editor",
      { p_project_id: request.projectId, p_user_id: user.id }
    );

    if (authzError) {
      console.error("[invite-member] Authorization check failed:", authzError);
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Failed to verify permissions",
        origin
      );
    }

    if (!isEditor) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        "You don't have permission to invite members to this project",
        origin
      );
    }

    // Check if user with this email is already a member
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", request.email.trim().toLowerCase())
      .single();

    if (existingProfile) {
      const { data: existingMember } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", request.projectId)
        .eq("user_id", existingProfile.id)
        .single();

      if (existingMember) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "This user is already a member of this project",
          origin
        );
      }
    }

    // Get project info and inviter's profile for the email (parallelized)
    const [projectResult, inviterResult] = await Promise.all([
      supabase.from("projects").select("name").eq("id", request.projectId).single(),
      supabase.from("profiles").select("name, email").eq("id", user.id).single(),
    ]);

    const project = projectResult.data;
    const inviterProfile = inviterResult.data;

    // Create the invitation
    const { data: invitation, error: insertError } = await supabase
      .from("project_invitations")
      .insert({
        project_id: request.projectId,
        email: request.email.trim().toLowerCase(),
        role: request.role,
        invited_by: user.id,
      })
      .select("id, token, expires_at")
      .single();

    if (insertError) {
      // Check for unique constraint violation (already invited)
      if (insertError.code === "23505") {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "An invitation has already been sent to this email address",
          origin
        );
      }
      console.error("[invite-member] Failed to create invitation:", insertError);
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Failed to create invitation",
        origin
      );
    }

    // Send the invitation email
    const inviteUrl = `${appUrl}/invite/${invitation.token}`;
    const emailSent = await sendInvitationEmail({
      to: request.email,
      inviterName: inviterProfile?.name ?? inviterProfile?.email ?? "A collaborator",
      projectName: project?.name ?? "Untitled Project",
      role: request.role,
      inviteUrl,
    });

    const response: InviteMemberResponse = {
      invitationId: invitation.id,
      expiresAt: invitation.expires_at,
      emailSent,
    };

    return createSuccessResponse(response, origin);
  } catch (error) {
    console.error("[invite-member] Error:", error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes("authorization") ||
        error.message.includes("token")
      ) {
        return createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          error.message,
          origin
        );
      }
    }

    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to send invitation",
      origin
    );
  }
});
