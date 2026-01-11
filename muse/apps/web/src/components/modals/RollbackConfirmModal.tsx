/**
 * RollbackConfirmModal
 *
 * Confirmation dialog for rolling back Knowledge PRs (suggestions).
 * Displays impact analysis before allowing rollback.
 */

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle, CornerUpLeft, Loader2, X, AlertCircle, Link } from "lucide-react";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from "@mythos/ui";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

interface RollbackImpact {
  kind: string;
  entityName?: string;
  relationshipCount?: number;
  relationships?: Array<{
    id: string;
    sourceEntity?: string;
    targetEntity?: string;
    type: string;
  }>;
  warning?: string;
}

interface RollbackImpactResult {
  canRollback: boolean;
  error?: string;
  alreadyRolledBack?: boolean;
  impact?: RollbackImpact;
}

export interface RollbackConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The suggestion ID to rollback */
  suggestionId: string | null;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when rollback is confirmed */
  onConfirm: (suggestionId: string, cascadeRelationships: boolean) => Promise<void>;
  /** Whether rollback is in progress */
  isRollingBack?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function titleCase(input: string): string {
  return input
    .split(/[_.\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getImpactDescription(impact: RollbackImpact): string {
  switch (impact.kind) {
    case "entity.create":
      return `This will delete the entity "${impact.entityName ?? "Unknown"}".`;
    case "entity.update":
      return `This will revert changes to "${impact.entityName ?? "Unknown"}".`;
    case "relationship.create":
      return "This will delete the relationship.";
    case "relationship.update":
      return "This will revert changes to the relationship.";
    case "memory.commit_decision":
      return "This will remove the pinned canon decision.";
    default:
      return `This will undo the ${titleCase(impact.kind)} operation.`;
  }
}

// ============================================================================
// Component
// ============================================================================

export function RollbackConfirmModal({
  isOpen,
  suggestionId,
  onClose,
  onConfirm,
  isRollingBack = false,
}: RollbackConfirmModalProps): JSX.Element | null {
  const [localError, setLocalError] = useState<string | null>(null);

  // Query rollback impact
  const apiAny: any = api;
  const impact = useQuery(
    apiAny.knowledgeSuggestions.getRollbackImpact,
    suggestionId ? { suggestionId: suggestionId as Id<"knowledgeSuggestions"> } : "skip"
  ) as RollbackImpactResult | undefined;

  // Reset error when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !isRollingBack) {
        onClose();
      }
    },
    [onClose, isRollingBack]
  );

  const handleConfirm = useCallback(async () => {
    if (!suggestionId || !impact?.canRollback) return;
    setLocalError(null);
    try {
      await onConfirm(suggestionId, true);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Rollback failed");
    }
  }, [suggestionId, impact?.canRollback, onConfirm, onClose]);

  if (!isOpen || !suggestionId) return null;

  const isLoading = impact === undefined;
  const canProceed = impact?.canRollback && !isRollingBack && !isLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rollback-confirm-title"
      data-testid="rollback-confirm-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={isRollingBack ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-xl border-mythos-border-default">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-mythos-accent-amber/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-mythos-accent-amber" />
              </div>
              <CardTitle id="rollback-confirm-title" className="text-lg">
                Confirm Undo
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isRollingBack}
              data-testid="rollback-confirm-close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 text-mythos-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Checking rollback impact...</span>
            </div>
          )}

          {/* Error state from query */}
          {impact && !impact.canRollback && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30 text-mythos-accent-red text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{impact.error || "Cannot rollback this change"}</span>
            </div>
          )}

          {/* Local error from action */}
          {localError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30 text-mythos-accent-red text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          {/* Impact description */}
          {impact?.canRollback && impact.impact && (
            <>
              <p className="text-sm text-mythos-text-secondary">
                {getImpactDescription(impact.impact)}
              </p>

              {/* Warning about cascade */}
              {impact.impact.warning && (
                <div className="p-3 rounded-lg bg-mythos-accent-amber/10 border border-mythos-accent-amber/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-mythos-accent-amber flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-mythos-accent-amber">
                      {impact.impact.warning}
                    </p>
                  </div>
                </div>
              )}

              {/* Relationship list */}
              {impact.impact.relationships && impact.impact.relationships.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
                    Affected relationships
                  </p>
                  <div className="space-y-1.5">
                    {impact.impact.relationships.map((rel) => (
                      <div
                        key={rel.id}
                        className="flex items-center gap-2 text-xs text-mythos-text-secondary p-2 rounded bg-mythos-bg-secondary/50"
                      >
                        <Link className="w-3 h-3 text-mythos-text-muted flex-shrink-0" />
                        <span className="truncate">
                          {rel.sourceEntity ?? "?"} <span className="text-mythos-text-muted">→</span>{" "}
                          <span className="text-mythos-accent-primary">{rel.type}</span>{" "}
                          <span className="text-mythos-text-muted">→</span> {rel.targetEntity ?? "?"}
                        </span>
                      </div>
                    ))}
                    {impact.impact.relationshipCount &&
                      impact.impact.relationshipCount > impact.impact.relationships.length && (
                        <p className="text-xs text-mythos-text-muted pl-5">
                          +{impact.impact.relationshipCount - impact.impact.relationships.length} more
                        </p>
                      )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Info about action */}
          {impact?.canRollback && (
            <div className="p-3 rounded-lg bg-mythos-bg-secondary/50 border border-mythos-border-default">
              <p className="text-xs text-mythos-text-muted">
                This action cannot be undone. The change will be reverted to its previous state.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-2 pt-4 border-t border-mythos-border-default">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRollingBack}
            data-testid="rollback-confirm-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canProceed}
            data-testid="rollback-confirm-submit"
          >
            {isRollingBack ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Undoing...
              </>
            ) : (
              <>
                <CornerUpLeft className="w-4 h-4" />
                Undo Change
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
