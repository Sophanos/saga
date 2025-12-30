/**
 * AnonymousLayout
 *
 * Wrapper for Layout that initializes anonymous session and shows trial banner.
 * This gives anonymous users the REAL app experience with trial limits.
 */

import { AlertCircle, Sparkles, LogIn } from "lucide-react";
import { Button, Card, cn } from "@mythos/ui";
import { Layout } from "../Layout";
import { SaveWorkPrompt } from "../auth/SaveWorkPrompt";
import { useAnonymousProjectLoader } from "../../hooks/useAnonymousProjectLoader";
import {
  useRemainingChatMessages,
  useIsTrialExhausted,
  useAnonymousStore,
} from "../../stores/anonymous";

interface AnonymousLayoutProps {
  onSignUp: () => void;
}

/**
 * Trial status banner shown at top
 */
function TrialBanner({ onSignUp }: { onSignUp: () => void }) {
  const remaining = useRemainingChatMessages();
  const isExhausted = useIsTrialExhausted();
  const serverTrialLimit = useAnonymousStore((s) => s.serverTrialLimit);
  const limit = serverTrialLimit ?? 5;

  return (
    <div
      className={cn(
        "px-4 py-2 flex items-center justify-between text-sm shrink-0",
        isExhausted
          ? "bg-mythos-accent-red/10 border-b border-mythos-accent-red/20"
          : "bg-mythos-accent-purple/10 border-b border-mythos-accent-purple/20"
      )}
    >
      <div className="flex items-center gap-2">
        {isExhausted ? (
          <>
            <AlertCircle className="w-4 h-4 text-mythos-accent-red" />
            <span className="text-mythos-text-secondary">
              Trial complete. Sign up to continue.
            </span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-mythos-accent-purple" />
            <span className="text-mythos-text-secondary">
              Trial mode:{" "}
              <strong className="text-mythos-text-primary">{remaining}</strong>{" "}
              of {limit} AI messages remaining
            </span>
          </>
        )}
      </div>
      <Button size="sm" variant="ghost" onClick={onSignUp} className="gap-1">
        <LogIn className="w-3 h-3" />
        Sign up free
      </Button>
    </div>
  );
}

/**
 * Anonymous layout - real app with trial banner
 */
export function AnonymousLayout({ onSignUp }: AnonymousLayoutProps) {
  const { isLoading, error } = useAnonymousProjectLoader();

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-mythos-accent-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-mythos-text-muted font-mono text-sm">
            Starting trial...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex items-center justify-center">
        <Card className="p-6 max-w-sm text-center">
          <AlertCircle className="w-12 h-12 text-mythos-accent-red mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">Something went wrong</h2>
          <p className="text-sm text-mythos-text-secondary mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex flex-col">
      {/* Trial banner at top */}
      <TrialBanner onSignUp={onSignUp} />

      {/* Real app layout */}
      <div className="flex-1 min-h-0">
        <Layout />
      </div>

      {/* Save work prompt (shows when trial exhausted) */}
      <SaveWorkPrompt onSignUp={onSignUp} />
    </div>
  );
}
