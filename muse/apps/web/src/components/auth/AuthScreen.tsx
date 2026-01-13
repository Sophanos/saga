/**
 * AuthScreen Component
 * Full-page authentication screen matching landing page style
 *
 * Uses Convex Auth with:
 * - OAuth: GitHub, Google, Apple
 * - Magic Links via Resend
 */

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { BookOpen, Mail, AlertCircle, Loader2, ArrowLeft, Github } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { isTauri, openInBrowser } from "../../lib/tauriAuth";

type AuthMode = "default" | "email-sent";

function getAuthRedirectTo(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  // Use deep link callback for Tauri, web callback otherwise
  if (isTauri()) {
    return "rhei://auth/callback";
  }
  return `${window.location.origin}/callback`;
}

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// Apple icon component
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.52-2.08-.53-3.23 0-1.44.66-2.2.51-3.06-.38C3.79 16.17 4.36 9.81 8.89 9.53c1.19.06 2.02.65 2.72.68.99-.19 1.94-.83 3.01-.76 1.29.1 2.26.61 2.91 1.54-2.66 1.59-2.03 5.08.52 6.06-.61 1.61-1.41 3.22-3 4.23zM12.03 9.47c-.13-2.39 1.75-4.35 4.01-4.47.28 2.69-2.45 4.69-4.01 4.47z"/>
    </svg>
  );
}

// Mini app preview component
function MiniAppPreview() {
  return (
    <div className="rounded-xl border border-mythos-border-default bg-mythos-bg-secondary overflow-hidden shadow-2xl shadow-black/50">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mythos-border-default bg-mythos-bg-primary/50">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-text-muted/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-text-muted/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-text-muted/20" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-2 py-0.5 rounded bg-mythos-bg-tertiary text-[10px] text-mythos-text-muted">
            Chapter 1 — The Beginning
          </div>
        </div>
      </div>

      {/* App content */}
      <div className="p-4 text-xs text-mythos-text-secondary leading-relaxed">
        <p className="mb-2">
          <span className="text-mythos-text-primary">Elena</span> stood at the edge of the cliff,
          watching the sun sink below the horizon...
        </p>
        <p className="text-mythos-text-muted">
          The weight of the <span className="text-mythos-text-primary">ancient tome</span> felt
          heavier in her hands.
        </p>
      </div>
    </div>
  );
}

interface AuthScreenProps {
  onBack?: () => void;
}

export function AuthScreen({ onBack }: AuthScreenProps) {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  // Helper to handle OAuth sign-in with Tauri support
  const handleOAuthSignIn = useCallback(async (provider: "github" | "google" | "apple") => {
    setIsLoading(true);
    setError(null);
    try {
      const redirectTo = getAuthRedirectTo();
      const result = redirectTo
        ? await signIn(provider, { redirectTo })
        : await signIn(provider);

      // In Tauri, open OAuth URL in system browser
      if (isTauri() && result?.redirect) {
        await openInBrowser(result.redirect.toString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setIsLoading(false);
    }
  }, [signIn]);

  const handleGitHubSignIn = useCallback(() => handleOAuthSignIn("github"), [handleOAuthSignIn]);
  const handleGoogleSignIn = useCallback(() => handleOAuthSignIn("google"), [handleOAuthSignIn]);
  const handleAppleSignIn = useCallback(() => handleOAuthSignIn("apple"), [handleOAuthSignIn]);

  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", email);
      const redirectTo = getAuthRedirectTo();
      if (redirectTo) {
        formData.append("redirectTo", redirectTo);
      }
      await signIn("resend", formData);
      setMode("email-sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send sign-in link");
    } finally {
      setIsLoading(false);
    }
  }, [email, signIn]);

  const backToDefault = useCallback(() => {
    setMode("default");
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-mythos-bg-primary flex flex-col">
      {/* Top bar with back button */}
      {(onBack || mode === "email-sent") && (
        <div className="absolute top-0 left-0 p-4 z-10">
          <button
            onClick={mode === "email-sent" ? backToDefault : onBack}
            className="flex items-center gap-2 text-mythos-text-muted hover:text-mythos-text-primary transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Left side - Branding */}
        <div className="hidden lg:flex lg:flex-1 flex-col justify-center px-12 xl:px-20 border-r border-mythos-border-default">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md"
          >
            {/* Logo */}
            <button
              onClick={onBack}
              className="flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity"
            >
              <BookOpen className="w-8 h-8 text-mythos-text-primary" />
              <span className="text-2xl font-semibold text-mythos-text-primary">Mythos</span>
            </button>

            {/* Headline */}
            <h1 className="text-3xl xl:text-4xl font-medium text-mythos-text-primary leading-tight mb-4">
              {mode === "email-sent" ? "Check your email" : "Welcome"}
            </h1>
            <p className="text-mythos-text-secondary text-lg mb-10">
              {mode === "email-sent"
                ? "We sent you a magic link to sign in."
                : "Sign in to continue crafting your story with AI-powered insights."}
            </p>

            {/* Mini preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <MiniAppPreview />
            </motion.div>
          </motion.div>
        </div>

        {/* Right side - Auth form */}
        <div className="flex-1 lg:max-w-xl flex flex-col justify-center px-6 sm:px-12 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm mx-auto"
          >
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <BookOpen className="w-6 h-6 text-mythos-text-primary" />
              <span className="text-xl font-semibold text-mythos-text-primary">Mythos</span>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-medium text-mythos-text-primary mb-2">
                {mode === "email-sent" ? "Check your email" : "Sign in"}
              </h2>
              <p className="text-mythos-text-muted text-sm">
                {mode === "email-sent"
                  ? `We sent a sign-in link to ${email}`
                  : "Choose your preferred sign-in method"}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6"
                data-testid="auth-error"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {mode === "email-sent" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-6"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm text-mythos-text-muted mb-6">
                  Click the link in your email to sign in. The link will expire in 10 minutes.
                </p>
                <button
                  type="button"
                  onClick={backToDefault}
                  className="text-sm text-mythos-text-primary hover:underline font-medium"
                >
                  Use a different method
                </button>
              </motion.div>
            ) : (
              <>
                {/* OAuth buttons */}
                <div className="space-y-3 mb-6">
                  <button
                    onClick={handleGitHubSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary hover:bg-mythos-bg-tertiary transition-colors text-sm font-medium text-mythos-text-primary disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Github className="w-5 h-5" />
                    )}
                    Continue with GitHub
                  </button>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary hover:bg-mythos-bg-tertiary transition-colors text-sm font-medium text-mythos-text-primary disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <GoogleIcon className="w-5 h-5" />
                    )}
                    Continue with Google
                  </button>

                  <button
                    onClick={handleAppleSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary hover:bg-mythos-bg-tertiary transition-colors text-sm font-medium text-mythos-text-primary disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <AppleIcon className="w-5 h-5" />
                    )}
                    Continue with Apple
                  </button>
                </div>

                {/* Divider */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-mythos-border-default" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-mythos-bg-primary px-3 text-mythos-text-muted">
                      or
                    </span>
                  </div>
                </div>

                {/* Email magic link form */}
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-mythos-text-secondary mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mythos-text-muted" />
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary text-mythos-text-primary placeholder:text-mythos-text-muted focus:outline-none focus:border-mythos-border-default-hover transition-colors"
                        required
                        disabled={isLoading}
                        data-testid="auth-email"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 rounded-lg bg-white text-bg-primary font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                    data-testid="auth-sign-in"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      "Send sign-in link"
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-mythos-border-default">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-mythos-text-muted">
          <span>© 2025 Mythos</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-mythos-text-primary transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-mythos-text-primary transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AuthScreen;
