/**
 * AdaptiveWelcome
 *
 * Shown after auth, adapts message based on what user did anonymously.
 *
 * Scenarios:
 * - Fresh signup: Full wizard (genre, template selection)
 * - Imported story: "Let's analyze your story" → skip to project
 * - Used chat: "Continue where you left off" → show chat
 * - Created entities: "Your world is ready" → show manifest
 */

import { useState } from "react";
import { Sparkles, FileText, MessageCircle, Users, ArrowRight, Loader2 } from "lucide-react";
import { Button, Card, cn } from "@mythos/ui";
import { useAnonymousStore, type AnonymousAction } from "../../stores/anonymous";
import {
  migrateAnonymousData,
  getAnonymousMigrationSummary,
} from "../../services/anonymousMigration";

interface AdaptiveWelcomeProps {
  userId: string;
  userName?: string;
  onComplete: (projectId?: string) => void;
  onSkipToWizard: () => void;
}

type WelcomeVariant = "fresh" | "imported" | "chatted" | "created";

function getVariant(actions: AnonymousAction[]): WelcomeVariant {
  if (actions.includes("imported_story")) return "imported";
  if (actions.includes("used_chat")) return "chatted";
  if (actions.includes("created_entity") || actions.includes("edited_document")) return "created";
  return "fresh";
}

const VARIANT_CONFIG: Record<
  WelcomeVariant,
  {
    icon: typeof Sparkles;
    iconColor: string;
    title: (name?: string) => string;
    subtitle: string;
    ctaText: string;
    showMigration: boolean;
  }
> = {
  fresh: {
    icon: Sparkles,
    iconColor: "text-mythos-accent-purple",
    title: (name) => (name ? `Welcome, ${name}!` : "Welcome to Muse!"),
    subtitle: "Let's set up your first project. Tell us about your story.",
    ctaText: "Get Started",
    showMigration: false,
  },
  imported: {
    icon: FileText,
    iconColor: "text-mythos-accent-cyan",
    title: () => "Great! Let's analyze your story",
    subtitle:
      "We'll detect characters, locations, and relationships from your imported text.",
    ctaText: "Analyze My Story",
    showMigration: true,
  },
  chatted: {
    icon: MessageCircle,
    iconColor: "text-mythos-accent-purple",
    title: () => "Continue where you left off",
    subtitle: "Your conversation has been saved. Pick up right where you were.",
    ctaText: "Open Chat",
    showMigration: true,
  },
  created: {
    icon: Users,
    iconColor: "text-mythos-accent-green",
    title: () => "Your world is ready",
    subtitle: "We've saved your entities and documents. Let's keep building.",
    ctaText: "View My World",
    showMigration: true,
  },
};

export function AdaptiveWelcome({
  userId,
  userName,
  onComplete,
  onSkipToWizard,
}: AdaptiveWelcomeProps) {
  const actions = useAnonymousStore((s) => s.actions);
  const summary = getAnonymousMigrationSummary();

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const variant = getVariant(actions);
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  const handleContinue = async () => {
    if (config.showMigration && summary.hasData) {
      setIsMigrating(true);
      setMigrationError(null);

      const result = await migrateAnonymousData(userId);

      setIsMigrating(false);

      if (result.success) {
        onComplete(result.projectId);
      } else {
        setMigrationError(result.error ?? "Migration failed");
      }
    } else {
      onComplete();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-mythos-bg-primary">
      <Card className="w-full max-w-lg p-8 text-center">
        {/* Icon */}
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
            config.iconColor.replace("text-", "bg-").replace(/\]$/, "/20]")
          )}
        >
          <Icon className={cn("w-8 h-8", config.iconColor)} />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-mythos-text-primary mb-2">
          {config.title(userName)}
        </h1>

        {/* Subtitle */}
        <p className="text-mythos-text-secondary mb-6">{config.subtitle}</p>

        {/* Migration summary */}
        {config.showMigration && summary.hasData && (
          <div className="bg-mythos-bg-tertiary rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-mythos-text-muted uppercase tracking-wide mb-2">
              Saving your work
            </p>
            <ul className="space-y-1 text-sm text-mythos-text-secondary">
              {summary.project && <li>• Project: {summary.project}</li>}
              {summary.documentCount > 0 && (
                <li>
                  • {summary.documentCount} document{summary.documentCount !== 1 ? "s" : ""}
                </li>
              )}
              {summary.entityCount > 0 && (
                <li>
                  • {summary.entityCount} entit{summary.entityCount !== 1 ? "ies" : "y"}
                </li>
              )}
              {summary.chatMessageCount > 0 && (
                <li>
                  • {summary.chatMessageCount} chat message
                  {summary.chatMessageCount !== 1 ? "s" : ""}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Error */}
        {migrationError && (
          <div className="bg-red-500/10 text-red-400 rounded-lg p-3 mb-4 text-sm">
            {migrationError}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button className="w-full" onClick={handleContinue} disabled={isMigrating}>
            {isMigrating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {config.ctaText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          {variant !== "fresh" && (
            <Button variant="ghost" className="w-full" onClick={onSkipToWizard}>
              Start fresh instead
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
