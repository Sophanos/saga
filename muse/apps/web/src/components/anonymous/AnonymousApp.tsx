/**
 * AnonymousApp
 *
 * Simplified app experience for anonymous trial users.
 * Provides a focused AI chat experience with trial limits.
 */

import { useEffect, useState, useCallback } from "react";
import { MessageCircle, LogIn, Sparkles, AlertCircle } from "lucide-react";
import { Button, Card, cn } from "@mythos/ui";
import { SaveWorkPrompt } from "../auth/SaveWorkPrompt";
import { useAnonymousStore, useRemainingChatMessages, useIsTrialExhausted } from "../../stores/anonymous";
import { ensureAnonSession } from "../../services/anonymousSession";

interface AnonymousAppProps {
  onSignUp: () => void;
}

/**
 * Trial status banner shown at top of anonymous app
 */
function TrialBanner({
  remaining,
  limit,
  isExhausted,
  onSignUp,
}: {
  remaining: number;
  limit: number;
  isExhausted: boolean;
  onSignUp: () => void;
}) {
  return (
    <div
      className={cn(
        "px-4 py-2 flex items-center justify-between text-sm",
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
              Trial mode: <strong className="text-mythos-text-primary">{remaining}</strong> of {limit} AI messages remaining
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
 * Simple chat interface for anonymous users
 */
function AnonymousChat({
  isExhausted,
  onSendMessage,
}: {
  isExhausted: boolean;
  onSendMessage: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const chatMessages = useAnonymousStore((s) => s.chatMessages);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isExhausted) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-mythos-accent-purple" />
            </div>
            <h3 className="text-lg font-medium text-mythos-text-primary mb-2">
              Try the AI Writing Assistant
            </h3>
            <p className="text-sm text-mythos-text-secondary max-w-sm">
              Ask questions about world-building, get help developing characters,
              or brainstorm plot ideas. You have 5 free messages to explore.
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[80%] p-3 rounded-lg",
                msg.role === "user"
                  ? "ml-auto bg-mythos-accent-purple/20 text-mythos-text-primary"
                  : "bg-mythos-bg-tertiary text-mythos-text-secondary"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-mythos-bg-tertiary">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isExhausted ? "Sign up to continue..." : "Ask the AI..."}
            disabled={isExhausted}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg bg-mythos-bg-tertiary border border-mythos-bg-tertiary",
              "text-mythos-text-primary placeholder:text-mythos-text-muted",
              "focus:outline-none focus:border-mythos-accent-purple/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <Button type="submit" disabled={isExhausted || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Main anonymous app component
 */
export function AnonymousApp({ onSignUp }: AnonymousAppProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const remaining = useRemainingChatMessages();
  const isExhausted = useIsTrialExhausted();
  const setServerTrialStatus = useAnonymousStore((s) => s.setServerTrialStatus);
  const addChatMessage = useAnonymousStore((s) => s.addChatMessage);
  const startSession = useAnonymousStore((s) => s.startSession);
  const serverTrialLimit = useAnonymousStore((s) => s.serverTrialLimit);

  // Initialize anonymous session on mount
  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      try {
        setIsLoading(true);
        setError(null);

        // Start local session
        startSession();

        // Get/create server session
        const session = await ensureAnonSession();

        if (!cancelled) {
          setServerTrialStatus(session.trial);
        }
      } catch (err) {
        console.error("[AnonymousApp] Failed to initialize:", err);
        if (!cancelled) {
          setError("Failed to start trial. Please refresh and try again.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    return () => {
      cancelled = true;
    };
  }, [startSession, setServerTrialStatus]);

  // Handle sending a message (placeholder - actual AI call would go here)
  const handleSendMessage = useCallback(
    async (message: string) => {
      // Add user message
      addChatMessage({ role: "user", content: message });

      // TODO: Actually call the AI chat edge function here
      // For now, just add a placeholder response
      setTimeout(() => {
        addChatMessage({
          role: "assistant",
          content:
            "This is a demo response. In the full version, this would be powered by the AI assistant.",
        });
      }, 1000);
    },
    [addChatMessage]
  );

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
      {/* Trial banner */}
      <TrialBanner
        remaining={remaining}
        limit={serverTrialLimit ?? 5}
        isExhausted={isExhausted}
        onSignUp={onSignUp}
      />

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar with info */}
        <div className="w-80 bg-mythos-bg-secondary border-r border-mythos-bg-tertiary p-6 hidden md:block">
          <h1 className="text-xl font-medium text-mythos-text-primary mb-2">
            Mythos IDE
          </h1>
          <p className="text-sm text-mythos-text-secondary mb-6">
            AI-powered creative writing environment for fiction authors.
          </p>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-mythos-bg-tertiary">
              <h3 className="font-medium text-mythos-text-primary text-sm mb-2">
                What you can try
              </h3>
              <ul className="text-xs text-mythos-text-secondary space-y-1">
                <li>Ask for character development ideas</li>
                <li>Get help with world-building</li>
                <li>Brainstorm plot points</li>
                <li>Request writing feedback</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-mythos-accent-purple/10 border border-mythos-accent-purple/20">
              <h3 className="font-medium text-mythos-text-primary text-sm mb-2">
                Full version includes
              </h3>
              <ul className="text-xs text-mythos-text-secondary space-y-1">
                <li>Unlimited AI assistance</li>
                <li>Entity tracking & World Graph</li>
                <li>Real-time consistency checking</li>
                <li>Document & project management</li>
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <Button className="w-full" onClick={onSignUp}>
              <LogIn className="w-4 h-4 mr-2" />
              Sign up free
            </Button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-mythos-bg-primary">
          <AnonymousChat isExhausted={isExhausted} onSendMessage={handleSendMessage} />
        </div>
      </div>

      {/* Save work prompt (shows when trial exhausted) */}
      <SaveWorkPrompt onSignUp={onSignUp} />
    </div>
  );
}
