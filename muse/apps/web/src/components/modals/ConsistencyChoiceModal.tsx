/**
 * ConsistencyChoiceModal
 * 
 * Displayed when a consistency issue is detected that requires user choice.
 * Part of Phase 3 progressive disclosure - helps establish canon.
 */

import { useState, useCallback, useEffect } from "react";
import { X, AlertTriangle, Check, FileText, ChevronRight } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  ScrollArea,
  cn,
} from "@mythos/ui";
import type { LinterIssue } from "../../stores";
import type { CanonChoice } from "@mythos/ai";

// Re-export CanonChoice for external use
export type { CanonChoice };

/**
 * Extended linter issue with canon choice information
 * Note: isContradiction, canonQuestion, canonChoices, evidence are already on ConsistencyIssue
 * We just add description and override evidence with a more flexible type
 */
export interface ConsistencyIssueWithChoices extends Omit<LinterIssue, "evidence"> {
  description?: string;
  evidence?: Array<{
    documentHint?: string;
    line?: number;
    text: string;
  }>;
}

export interface ConsistencyChoiceModalProps {
  isOpen: boolean;
  issue: ConsistencyIssueWithChoices | null;
  onClose: () => void;
  onChoose: (choiceId: string, choice: CanonChoice) => void;
  isApplying?: boolean;
}

// ============================================================================
// Choice Option Component
// ============================================================================

interface ChoiceOptionProps {
  choice: CanonChoice;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function ChoiceOption({ choice, isSelected, onSelect, disabled }: ChoiceOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full p-4 rounded-lg border-2 text-left transition-all",
        isSelected
          ? "border-mythos-accent-primary bg-mythos-accent-primary/10"
          : "border-mythos-border-default hover:border-mythos-text-muted/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
            isSelected
              ? "border-mythos-accent-primary bg-mythos-accent-primary"
              : "border-mythos-text-muted"
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-mythos-bg-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-mythos-text-primary">
            {choice.label}
          </p>
          {choice.explanation && (
            <p className="text-xs text-mythos-text-muted mt-1">
              {choice.explanation}
            </p>
          )}
          {choice.value !== undefined && (
            <p className="text-xs text-mythos-accent-primary mt-1 font-mono">
              "{String(choice.value)}"
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Evidence Section
// ============================================================================

interface EvidenceSectionProps {
  evidence: Array<{ documentHint?: string; line?: number; text: string }>;
}

function EvidenceSection({ evidence }: EvidenceSectionProps) {
  if (evidence.length === 0) return null;

  return (
    <div className="mt-4 p-3 rounded-lg bg-mythos-bg-tertiary/50">
      <p className="text-xs font-medium text-mythos-text-secondary mb-2 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        Evidence from your text
      </p>
      <div className="space-y-2">
        {evidence.map((item, i) => (
          <div key={i} className="text-xs">
            {item.documentHint && (
              <span className="text-mythos-accent-purple font-medium">
                {item.documentHint}
                {item.line && `:${item.line}`}
              </span>
            )}
            <p className="text-mythos-text-muted italic mt-0.5">
              "{item.text}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function ConsistencyChoiceModal({
  isOpen,
  issue,
  onClose,
  onChoose,
  isApplying = false,
}: ConsistencyChoiceModalProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  // Reset selection when issue changes or modal reopens
  useEffect(() => {
    setSelectedChoiceId(null);
  }, [issue?.id, isOpen]);

  const handleChoose = useCallback(() => {
    if (!selectedChoiceId || !issue?.canonChoices) return;
    
    const choice = issue.canonChoices.find((c) => c.id === selectedChoiceId);
    if (choice) {
      onChoose(selectedChoiceId, choice);
    }
  }, [selectedChoiceId, issue, onChoose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isApplying) {
        onClose();
      }
      if (e.key === "Enter" && selectedChoiceId && !isApplying) {
        handleChoose();
      }
    },
    [onClose, isApplying, selectedChoiceId, handleChoose]
  );

  // Reset selection when issue changes
  if (!isOpen) {
    return null;
  }

  if (!issue) {
    return null;
  }

  const choices = issue.canonChoices ?? [];
  const evidence = issue.evidence ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consistency-choice-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={isApplying ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-xl border-mythos-border-default">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-mythos-accent-amber/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-mythos-accent-amber" />
              </div>
              <CardTitle id="consistency-choice-title" className="text-lg">
                Establish Canon
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isApplying}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription className="pt-2">
            {issue.canonQuestion || issue.description || "Choose which version is correct for your story."}
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-4">
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3 pr-2">
              {choices.length > 0 ? (
                choices.map((choice) => (
                  <ChoiceOption
                    key={choice.id}
                    choice={choice}
                    isSelected={selectedChoiceId === choice.id}
                    onSelect={() => setSelectedChoiceId(choice.id)}
                    disabled={isApplying}
                  />
                ))
              ) : (
                <p className="text-sm text-mythos-text-muted text-center py-4">
                  No resolution options available. Please resolve this manually.
                </p>
              )}
            </div>

            {evidence.length > 0 && <EvidenceSection evidence={evidence} />}
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex justify-between gap-2 pt-4 border-t border-mythos-border-default">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isApplying}
          >
            Decide Later
          </Button>
          <Button
            type="button"
            onClick={handleChoose}
            disabled={isApplying || !selectedChoiceId || choices.length === 0}
            className="gap-1.5 min-w-[140px]"
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              <>
                Establish Canon
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Types are already exported above via interface/type declarations
