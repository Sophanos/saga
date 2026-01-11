/**
 * AuthCallback Component
 * Handles OAuth callback from Better Auth
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface AuthCallbackProps {
  onComplete?: () => void;
}

export function AuthCallback({ onComplete }: AuthCallbackProps) {
  const [error] = useState<string | null>(null);

  useEffect(() => {
    // Better Auth handles the OAuth callback automatically via crossDomainClient
    // Just wait a moment for the session to be established, then redirect
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else {
        window.location.href = "/";
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (error) {
    return (
      <div className="min-h-screen bg-mythos-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="text-mythos-accent-red mb-4">Authentication failed</div>
          <p className="text-mythos-text-muted text-sm mb-4">{error}</p>
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
