/**
 * SaveWorkPrompt
 *
 * Soft prompt shown to anonymous users when they:
 * - Hit the 5-message chat limit
 * - Try to save/export
 * - Have been active for a while
 *
 * Not blocking - user can dismiss and continue with limited features.
 */

import { X, Save, MessageCircle, FileText } from "lucide-react";
import { Button, Card, cn } from "@mythos/ui";
import { useAnonymousStore, useShouldShowAuthPrompt } from "../../stores/anonymous";
import { getAnonymousMigrationSummary } from "../../services/anonymousMigration";

interface SaveWorkPromptProps {
  onSignUp: () => void;
  className?: string;
}

export function SaveWorkPrompt({ onSignUp, className }: SaveWorkPromptProps) {
  const shouldShow = useShouldShowAuthPrompt();
  const dismissPrompt = useAnonymousStore((s) => s.dismissAuthPrompt);
  const summary = getAnonymousMigrationSummary();

  if (!shouldShow) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", className)}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/60 backdrop-blur-sm"
        onClick={dismissPrompt}
      />

      {/* Card */}
      <Card className="relative z-10 w-full max-w-md p-6 shadow-xl border-mythos-accent-purple/30">
        <button
          onClick={dismissPrompt}
          className="absolute top-4 right-4 text-mythos-text-muted hover:text-mythos-text-primary"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center mx-auto mb-4">
            <Save className="w-6 h-6 text-mythos-accent-purple" />
          </div>
          <h2 className="text-lg font-medium text-mythos-text-primary mb-2">
            Sign up to save your work
          </h2>
          <p className="text-sm text-mythos-text-secondary">
            Create a free account to keep your progress and unlock all features.
          </p>
        </div>

        {/* What will be saved */}
        {summary.hasData && (
          <div className="bg-mythos-bg-tertiary rounded-lg p-4 mb-6">
            <p className="text-xs text-mythos-text-muted uppercase tracking-wide mb-3">
              Your work will be saved
            </p>
            <div className="space-y-2">
              {summary.project && (
                <div className="flex items-center gap-2 text-sm text-mythos-text-secondary">
                  <FileText className="w-4 h-4 text-mythos-accent-cyan" />
                  <span>Project: {summary.project}</span>
                </div>
              )}
              {summary.documentCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-mythos-text-secondary">
                  <FileText className="w-4 h-4 text-mythos-accent-green" />
                  <span>
                    {summary.documentCount} document{summary.documentCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {summary.chatMessageCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-mythos-text-secondary">
                  <MessageCircle className="w-4 h-4 text-mythos-accent-purple" />
                  <span>
                    {summary.chatMessageCount} chat message{summary.chatMessageCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button className="w-full" onClick={onSignUp}>
            Create Free Account
          </Button>
          <Button variant="ghost" className="w-full" onClick={dismissPrompt}>
            Continue without saving
          </Button>
        </div>

        <p className="text-[10px] text-mythos-text-muted text-center mt-4">
          Your data stays on this device until you sign up
        </p>
      </Card>
    </div>
  );
}
