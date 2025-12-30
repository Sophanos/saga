/**
 * AnonymousLayout
 *
 * Premium trial experience with Notion+Cursor inspired design.
 * Clean, minimal chrome with elegant onboarding for first-time users.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  BookOpen,
  FileText,
  Upload,
  ArrowRight,
  Wand2,
  ChevronRight,
} from "lucide-react";
import { Layout } from "../Layout";
import { SaveWorkPrompt } from "../auth/SaveWorkPrompt";
import { useAnonymousProjectLoader } from "../../hooks/useAnonymousProjectLoader";
import {
  useRemainingChatMessages,
  useIsTrialExhausted,
  useAnonymousStore,
} from "../../stores/anonymous";
import { useMythosStore } from "../../stores";

interface AnonymousLayoutProps {
  onSignUp: () => void;
}

/**
 * Floating trial indicator - subtle pill in corner
 */
function TrialIndicator({ onSignUp }: { onSignUp: () => void }) {
  const remaining = useRemainingChatMessages();
  const isExhausted = useIsTrialExhausted();
  const serverTrialLimit = useAnonymousStore((s) => s.serverTrialLimit);
  const limit = serverTrialLimit ?? 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      className="fixed top-3 right-3 z-50"
    >
      <div
        className={`
          flex items-center gap-3 px-3 py-1.5 rounded-full
          border backdrop-blur-md text-sm
          ${
            isExhausted
              ? "bg-red-500/10 border-red-500/20 text-red-300"
              : "bg-bg-secondary/80 border-border text-text-secondary"
          }
        `}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-text-muted">
            {isExhausted ? (
              "Trial complete"
            ) : (
              <>
                <span className="text-text-primary font-medium">{remaining}</span>
                <span className="text-text-muted">/{limit}</span>
              </>
            )}
          </span>
        </div>
        <button
          onClick={onSignUp}
          className="text-text-primary hover:text-white transition-colors text-xs font-medium"
        >
          Sign up free
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Premium loading state
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
 * Error state with retry
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
 * Welcome screen for first-time trial users
 */
function TrialWelcome({ onStart, onSignUp }: { onStart: () => void; onSignUp: () => void }) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span className="font-semibold">Mythos</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onSignUp}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={onSignUp}
              className="px-3 py-1.5 rounded-lg bg-white text-bg-primary text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-secondary border border-border text-xs text-text-muted mb-6"
          >
            <Sparkles className="w-3 h-3" />
            <span>5 free AI interactions</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-medium leading-tight mb-4"
          >
            Try Mythos{" "}
            <span className="text-text-secondary">— your story's database</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-text-muted text-lg mb-10"
          >
            Paste your chapter. Watch AI extract characters, locations, and items automatically.
          </motion.p>

          {/* Action cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid md:grid-cols-2 gap-4 mb-8"
          >
            {/* Start writing */}
            <button
              onClick={onStart}
              className="group p-6 rounded-xl border border-border bg-bg-secondary/30 hover:bg-bg-secondary/60 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-bg-tertiary text-text-muted group-hover:text-text-primary transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-text-primary">Start fresh</h3>
              </div>
              <p className="text-sm text-text-muted mb-4">
                Create a new document and start writing. AI will track your characters and world as you go.
              </p>
              <div className="flex items-center gap-1 text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                <span>Begin writing</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Import content */}
            <button
              onClick={onStart}
              className="group p-6 rounded-xl border border-border bg-bg-secondary/30 hover:bg-bg-secondary/60 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-bg-tertiary text-text-muted group-hover:text-text-primary transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-text-primary">Import existing work</h3>
              </div>
              <p className="text-sm text-text-muted mb-4">
                Paste your chapter or manuscript. We'll automatically extract entities and build your world.
              </p>
              <div className="flex items-center gap-1 text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                <span>Import content</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </motion.div>

          {/* Features preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-6 text-xs text-text-muted"
          >
            <span className="flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              Auto entity extraction
            </span>
            <span className="flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              Consistency checking
            </span>
            <span className="flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              World graph visualization
            </span>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-text-muted">
          <span>© 2025 Mythos</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-text-primary transition-colors">
              Privacy
            </a>
            <a href="/terms" className="hover:text-text-primary transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Anonymous layout - premium trial experience
 */
export function AnonymousLayout({ onSignUp }: AnonymousLayoutProps) {
  const { isLoading, error } = useAnonymousProjectLoader();
  const [showWelcome, setShowWelcome] = useState(true);
  const documents = useMythosStore((s) => s.document.documents);
  const hasDocuments = documents.size > 0;

  const handleStart = useCallback(() => {
    setShowWelcome(false);
  }, []);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  // Show welcome screen for new users without documents
  if (showWelcome && !hasDocuments) {
    return <TrialWelcome onStart={handleStart} onSignUp={onSignUp} />;
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary font-sans antialiased flex flex-col">
      {/* Floating trial indicator */}
      <TrialIndicator onSignUp={onSignUp} />

      {/* Real app layout */}
      <div className="flex-1 min-h-0">
        <Layout />
      </div>

      {/* Save work prompt (shows when trial exhausted) */}
      <SaveWorkPrompt onSignUp={onSignUp} />
    </div>
  );
}
