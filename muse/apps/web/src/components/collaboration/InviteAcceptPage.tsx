import { useEffect, useState, useCallback } from "react";
import { BookOpen, Loader2, AlertCircle, CheckCircle, LogOut } from "lucide-react";
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

type AcceptStatus = "loading" | "needs_auth" | "accepting" | "success" | "error";

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

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
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

      // User is authenticated, try to accept the invitation
      setStatus("accepting");
      
      try {
        const result = await acceptInvitation(token);
        
        if (result.success) {
          // Store the project ID so app loads it after redirect
          localStorage.setItem(LAST_PROJECT_KEY, result.projectId);
          // Clear the pending token
          sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
          
          setStatus("success");
          
          // Redirect to main app after a short delay
          setTimeout(() => {
            window.location.assign("/");
          }, 1500);
        }
      } catch (err) {
        console.error("Failed to accept invitation:", err);
        setError(
          err instanceof Error 
            ? err.message 
            : "Failed to accept invitation. It may be expired or already used."
        );
        setStatus("error");
      }
    }

    checkAndAccept();
  }, [token, isAuthenticated, isLoading]);

  // Fetch invitation info for display (optional enhancement)
  useEffect(() => {
    async function fetchInfo() {
      try {
        const invitation = await getInvitationByToken(token);
        if (invitation) {
          setInvitationInfo({
            email: invitation.email,
            role: invitation.role,
          });
        }
      } catch {
        // Non-critical - just won't show invitation details
      }
    }
    fetchInfo();
  }, [token]);

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
