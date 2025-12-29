/**
 * AuthCallback Component
 * Handles OAuth callback redirects and password recovery flows
 */

import { useEffect, useState } from "react";
import { BookOpen, Loader2, AlertCircle, CheckCircle, Lock } from "lucide-react";
import { getSupabaseClient } from "@mythos/db";
import { Button, Card, CardContent, Input } from "@mythos/ui";

type CallbackStatus = "processing" | "success" | "error" | "password_recovery";

interface AuthCallbackProps {
  onComplete?: () => void;
}

export function AuthCallback({ onComplete }: AuthCallbackProps) {
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [error, setError] = useState<string | null>(null);

  // Password recovery state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const supabase = getSupabaseClient();

        // Get the code from URL
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorParam = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        // Check for OAuth error in URL
        if (errorParam) {
          setError(errorDescription || errorParam);
          setStatus("error");
          return;
        }

        if (!code) {
          // No code present, might be a hash-based flow or already processed
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            setStatus("success");
            // Clean up URL
            window.history.replaceState({}, document.title, "/");
            // Notify parent
            if (onComplete) {
              setTimeout(onComplete, 1000);
            }
          } else {
            setError("No authentication code found");
            setStatus("error");
          }
          return;
        }

        // Exchange code for session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          setStatus("error");
          return;
        }

        // Check if this is a password recovery flow
        // The session will have a user but we need to check if this came from a recovery link
        // We check the URL hash for type=recovery or the session's aal level
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const isRecovery = hashParams.get("type") === "recovery" ||
                          url.searchParams.get("type") === "recovery";

        if (isRecovery && data.session) {
          // This is a password recovery flow - show password reset form
          setStatus("password_recovery");
          // Clean up URL but stay on callback page
          window.history.replaceState({}, document.title, "/auth/callback");
          return;
        }

        // Success! Clean up URL and notify
        setStatus("success");
        window.history.replaceState({}, document.title, "/");

        if (onComplete) {
          setTimeout(onComplete, 1000);
        }
      } catch (err) {
        console.error("[AuthCallback] Error:", err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        setStatus("error");
      }
    }

    // Also listen for PASSWORD_RECOVERY auth event
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("[AuthCallback] PASSWORD_RECOVERY event detected");
        setStatus("password_recovery");
        window.history.replaceState({}, document.title, "/auth/callback");
      }
    });

    handleCallback();

    return () => {
      subscription.unsubscribe();
    };
  }, [onComplete]);

  const handleRetry = () => {
    // Redirect back to auth screen
    window.location.href = "/";
  };

  const handleUpdatePassword = async () => {
    setPasswordError(null);

    // Validate passwords
    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in both password fields");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
        return;
      }

      // Password updated successfully
      setStatus("success");
      window.history.replaceState({}, document.title, "/");

      if (onComplete) {
        setTimeout(onComplete, 1500);
      }
    } catch (err) {
      console.error("[AuthCallback] Password update error:", err);
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#07070a" }}>
      <Card className="w-full max-w-sm border-mythos-text-muted/20 bg-mythos-bg-secondary shadow-2xl">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Logo */}
            <div className="p-3 rounded-full bg-mythos-accent-cyan/10 border border-mythos-accent-cyan/20">
              <BookOpen className="w-6 h-6 text-mythos-accent-cyan" />
            </div>

            {status === "processing" && (
              <>
                <Loader2 className="w-8 h-8 text-mythos-accent-cyan animate-spin" />
                <div>
                  <h2 className="text-lg font-semibold text-mythos-text-primary">
                    Completing Sign In
                  </h2>
                  <p className="text-sm text-mythos-text-muted mt-1">
                    Please wait while we verify your credentials...
                  </p>
                </div>
              </>
            )}

            {status === "password_recovery" && (
              <>
                <Lock className="w-8 h-8 text-mythos-accent-cyan" />
                <div>
                  <h2 className="text-lg font-semibold text-mythos-text-primary">
                    Set New Password
                  </h2>
                  <p className="text-sm text-mythos-text-muted mt-1">
                    Enter your new password below
                  </p>
                </div>

                <div className="w-full space-y-3 mt-4">
                  <Input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isUpdatingPassword}
                    className="w-full"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isUpdatingPassword}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdatePassword()}
                    className="w-full"
                  />

                  {passwordError && (
                    <p className="text-sm text-mythos-accent-red">{passwordError}</p>
                  )}

                  <Button
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPassword}
                    className="w-full mt-2"
                  >
                    {isUpdatingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {isUpdatingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle className="w-8 h-8 text-mythos-accent-green" />
                <div>
                  <h2 className="text-lg font-semibold text-mythos-text-primary">
                    {newPassword ? "Password Updated" : "Sign In Successful"}
                  </h2>
                  <p className="text-sm text-mythos-text-muted mt-1">
                    Redirecting you to Mythos IDE...
                  </p>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <AlertCircle className="w-8 h-8 text-mythos-accent-red" />
                <div>
                  <h2 className="text-lg font-semibold text-mythos-text-primary">
                    Sign In Failed
                  </h2>
                  <p className="text-sm text-mythos-accent-red mt-1">
                    {error || "An error occurred during sign in"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthCallback;
