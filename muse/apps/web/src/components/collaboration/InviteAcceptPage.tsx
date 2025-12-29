import { useEffect, useState, useCallback, useRef } from "react";
import { BookOpen, Loader2, AlertCircle, CheckCircle, LogOut, AlertTriangle } from "lucide-react";
import { acceptInvitation, getInvitationByToken } from "@mythos/db";
import { Button, Card, CardContent } from "@mythos/ui";
import { useAuthStore } from "../../stores/auth";
import { AuthScreen } from "../auth";
import { LAST_PROJECT_KEY, PENDING_INVITE_TOKEN_KEY } from "../../constants/storageKeys";

// ============================================================================
// Types
// ============================================================================

interface InviteAcceptPageProps {
  token: string;
}

type AcceptStatus = "loading" | "needs_auth" | "email_mismatch" | "accepting" | "success" | "error";

interface InvitationInfo {
  email: string;
  projectName?: string;
  role: string;
}

// ============================================================================
// Component
// ============================================================================

export function InviteAcceptPage({ token }: InviteAcceptPageProps) {
  const [status, setStatus] = useState<AcceptStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  // Persist token to sessionStorage for OAuth flows
  useEffect(() => {
    sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
  }, [token]);

  // Check invitation validity and handle acceptance
  useEffect(() => {
    async function checkAndAccept() {
      // Wait for auth state to settle
      if (isLoading) return;

      // If not authenticated, show auth screen
      if (!isAuthenticated) {
        setStatus("needs_auth");
        return;
      }

      // User is authenticated - fetch invitation info first to validate email
      try {
        const invitation = await getInvitationByToken(token);

        if (!invitation) {
          setError("Invitation not found. It may be expired or already used.");
          setStatus("error");
          return;
        }

        // Store invitation info for display
        setInvitationInfo({
          email: invitation.email,
          role: invitation.role,
        });

        // Check if invitation email matches logged-in user's email
        const userEmail = user?.email?.toLowerCase();
        const invitationEmail = invitation.email.toLowerCase();

        if (userEmail && userEmail !== invitationEmail) {
          // Email mismatch - warn user before proceeding
          setStatus("email_mismatch");
          return;
        }

        // Emails match or user has no email - proceed with acceptance
        await performAcceptance();
      } catch (err) {
        console.error("[Collaboration] Failed to check invitation:", err);
        setError(
          err instanceof Error 
            ? err.message 
            : "Failed to check invitation. Please try again."
        );
        setStatus("error");
      }
    }

    checkAndAccept();

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [token, isAuthenticated, isLoading, user?.email]);

  // Perform the actual invitation acceptance
  const performAcceptance = useCallback(async () => {
    setStatus("accepting");

    try {
      const result = await acceptInvitation(token);

      // Store the project ID so app loads it after redirect
      localStorage.setItem(LAST_PROJECT_KEY, result.projectId);
      // Clear the pending token
      sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);

      setStatus("success");

      // Redirect to main app after a short delay
      timeoutRef.current = setTimeout(() => {
        window.location.assign("/");
      }, 1500);
    } catch (err) {
      console.error("[Collaboration] Failed to accept invitation:", err);

      // Check for specific email mismatch error from RPC
      const errorMessage = err instanceof Error ? err.message : "";
      if (errorMessage.includes("Invitation was sent to a different email address")) {
        setError(
          "This invitation was sent to a different email address. Please sign in with that account."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to accept invitation. It may be expired or already used."
        );
      }
      setStatus("error");
    }
  }, [token]);

  // Handle user confirming they want to accept with mismatched email
  const handleConfirmMismatch = useCallback(async () => {
    await performAcceptance();
  }, [performAcceptance]);

  const handleSignOutAndRetry = useCallback(async () => {
    await signOut();
    // Clear the stored token so they can use a fresh link
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    window.location.assign(window.location.pathname);
  }, [signOut]);

  const handleReturnHome = useCallback(() => {
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    window.location.assign("/");
  }, []);

  // Show auth screen if user needs to sign in
  if (status === "needs_auth") {
    return (
      <div className="min-h-screen bg-mythos-bg-primary text-mythos-text-primary">
        <div className="max-w-md mx-auto pt-8 px-4">
          <Card className="mb-6 border-mythos-accent-cyan/30 bg-mythos-bg-secondary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-6 h-6 text-mythos-accent-cyan" />
                <h2 className="text-lg font-semibold text-mythos-text-primary">
                  You've been invited!
                </h2>
              </div>
              <p className="text-mythos-text-muted text-sm">
                Sign in or create an account to accept the invitation and start collaborating.
              </p>
              {invitationInfo && (
                <p className="text-mythos-text-secondary text-xs mt-2">
                  Invitation for: <span className="font-mono">{invitationInfo.email}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <AuthScreen onBack={handleReturnHome} />
      </div>
    );
  }

  // Email mismatch warning state
  if (status === "email_mismatch") {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center px-4 max-w-md">
          <AlertTriangle className="w-12 h-12 text-mythos-accent-yellow" />
          <div>
            <h2 className="text-xl font-semibold text-mythos-text-primary mb-2">
              Email Address Mismatch
            </h2>
            <p className="text-mythos-text-muted text-sm mb-3">
              This invitation was sent to{" "}
              <span className="font-mono text-mythos-text-secondary">
                {invitationInfo?.email}
              </span>
              , but you're signed in as{" "}
              <span className="font-mono text-mythos-text-secondary">
                {user?.email}
              </span>
              .
            </p>
            <p className="text-mythos-text-muted text-sm">
              You can sign in with the correct account, or continue with your current account if you have access.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              onClick={handleSignOutAndRetry}
              variant="outline"
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign in with correct account
            </Button>
            <Button
              onClick={handleConfirmMismatch}
              variant="ghost"
            >
              Continue anyway
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (status === "loading" || status === "accepting") {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <Loader2 className="w-8 h-8 text-mythos-accent-cyan animate-spin" />
          <span className="text-mythos-text-muted font-mono text-sm">
            {status === "loading" ? "Checking invitation..." : "Accepting invitation..."}
          </span>
        </div>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <CheckCircle className="w-12 h-12 text-mythos-accent-green" />
          <h2 className="text-xl font-semibold text-mythos-text-primary">
            Welcome to the project!
          </h2>
          <p className="text-mythos-text-muted text-sm">
            Redirecting you to the editor...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center px-4 max-w-md">
        <AlertCircle className="w-12 h-12 text-mythos-accent-red" />
        <div>
          <h2 className="text-xl font-semibold text-mythos-text-primary mb-2">
            Unable to Accept Invitation
          </h2>
          <p className="text-mythos-text-muted text-sm">
            {error || "The invitation link may be invalid, expired, or already used."}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button
            onClick={handleSignOutAndRetry}
            variant="outline"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign in with different account
          </Button>
          <Button
            onClick={handleReturnHome}
            variant="ghost"
          >
            Return home
          </Button>
        </div>
      </div>
    </div>
  );
}

export type { InviteAcceptPageProps };
