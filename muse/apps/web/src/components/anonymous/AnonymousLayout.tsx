/**
 * AnonymousLayout
 *
 * Trial experience that goes straight to the real app.
 * No welcome wizard - onboarding happens through the starter document.
 * Includes floating AI chat (trial indicator is inside the chat).
 */

import { useCallback } from "react";
import { motion } from "motion/react";
import { Layout } from "../Layout";
import { SaveWorkPrompt } from "../auth/SaveWorkPrompt";
import { FloatingAIChat } from "../trial/FloatingAIChat";
import { useAnonymousProjectLoader } from "../../hooks/useAnonymousProjectLoader";

interface AnonymousLayoutProps {
  onSignUp: () => void;
}

/**
 * Loading state
 */
function LoadingState() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 mx-auto mb-4"
        >
          <div className="w-full h-full rounded-full border-2 border-text-muted/20 border-t-text-primary" />
        </motion.div>
        <p className="text-sm text-text-muted">Preparing your workspace...</p>
      </motion.div>
    </div>
  );
}

/**
 * Error state
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <h2 className="text-lg font-medium text-text-primary mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-text-muted mb-6">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-bg-secondary border border-border hover:bg-bg-tertiary transition-colors text-sm font-medium"
        >
          Try again
        </button>
      </motion.div>
    </div>
  );
}

/**
 * Anonymous layout - straight to real app with floating AI chat
 */
export function AnonymousLayout({ onSignUp }: AnonymousLayoutProps) {
  const { isLoading, error } = useAnonymousProjectLoader();

  const handleSendMessage = useCallback((message: string) => {
    // TODO: Wire up to actual AI chat
    console.log("[AnonymousLayout] AI message:", message);
  }, []);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  // Go straight to the real app - no welcome screen
  // Trial indicator is inside the FloatingAIChat component
  return (
    <div className="h-screen bg-bg-primary text-text-primary font-sans antialiased flex flex-col">
      {/* Real app layout */}
      <div className="flex-1 min-h-0">
        <Layout />
      </div>

      {/* Floating AI chat (includes trial counter) */}
      <FloatingAIChat onSignUp={onSignUp} onSendMessage={handleSendMessage} />

      {/* Save work prompt (shows when trial exhausted) */}
      <SaveWorkPrompt onSignUp={onSignUp} />
    </div>
  );
}
