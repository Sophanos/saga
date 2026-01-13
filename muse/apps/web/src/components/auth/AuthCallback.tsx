/**
 * AuthCallback Component
 * Handles OAuth and magic link callbacks from Convex Auth
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useConvexAuth } from "convex/react";

interface AuthCallbackProps {
  onComplete?: () => void;
}

export function AuthCallback({ onComplete }: AuthCallbackProps): JSX.Element {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [timedOut, setTimedOut] = useState(false);

  const callbackParams = useMemo(() => {
    if (typeof window === "undefined") {
      return { code: null, state: null, error: null, errorDescription: null };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
      errorDescription: params.get("error_description"),
    };
  }, []);

  const hasCallbackParams = Boolean(
    callbackParams.code || callbackParams.state || callbackParams.error
  );
  const isCallbackPath =
    typeof window !== "undefined" && window.location.pathname === "/auth/callback";
  const hasCallbackFlow = hasCallbackParams || isCallbackPath;

  useEffect(() => {
    if (isAuthenticated) {
      if (onComplete) {
        onComplete();
      } else if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }, [isAuthenticated, onComplete]);

  useEffect(() => {
    if (isAuthenticated || isLoading) {
      return;
    }

    if (!hasCallbackFlow && typeof window !== "undefined") {
      window.location.href = "/login";
      return;
    }

    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [hasCallbackFlow, isAuthenticated, isLoading]);

  if (callbackParams.error || timedOut) {
    const message =
      callbackParams.errorDescription ||
      callbackParams.error ||
      "We could not complete your sign-in. Please try again.";
    return (
      <div className="min-h-screen bg-mythos-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="text-mythos-accent-red mb-4">Authentication failed</div>
          <p className="text-mythos-text-muted text-sm mb-4">{message}</p>
          <button
            onClick={() => window.location.href = "/login"}
            className="px-4 py-2 bg-mythos-bg-secondary border border-mythos-border-default rounded text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mythos-bg-primary flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-mythos-text-muted" />
        <span className="text-mythos-text-muted font-mono text-sm">Completing sign in...</span>
      </div>
    </div>
  );
}

export default AuthCallback;
