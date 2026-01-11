/**
 * PinPolicyModal
 *
 * Two-step approval modal for pinning policies to canon.
 * Shows decision + rationale, allows editing before confirm.
 * Part of Phase 4: Clarity/Policy Coach.
 */

import { useState, useCallback, useEffect } from "react";
import { X, Shield, Loader2, FileText, Edit2 } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cn,
} from "@mythos/ui";

export interface PinPolicyModalProps {
  isOpen: boolean;
  decision: string;
  rationale: string;
  onClose: () => void;
  onConfirm: (decision: string, rationale: string) => Promise<void>;
  isPinning?: boolean;
}

export function PinPolicyModal({
  isOpen,
  decision: initialDecision,
  rationale: initialRationale,
  onClose,
  onConfirm,
  isPinning,
}: PinPolicyModalProps) {
  const [decision, setDecision] = useState(initialDecision);
  const [rationale, setRationale] = useState(initialRationale);
  const [isEditing, setIsEditing] = useState(false);

  // Reset state when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      setDecision(initialDecision);
      setRationale(initialRationale);
      setIsEditing(false);
    }
  }, [isOpen, initialDecision, initialRationale]);

  const handleConfirm = useCallback(async () => {
    await onConfirm(decision, rationale);
  }, [decision, rationale, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      data-testid="policy-pin-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-2xl border-mythos-border-default bg-mythos-bg-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-mythos-accent-purple/10">
                <Shield className="w-5 h-5 text-mythos-accent-purple" />
              </div>
              <div>
                <CardTitle className="text-lg">Pin Policy</CardTitle>
                <CardDescription className="text-xs">
                  This will add a pinned policy to your project memory
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isPinning}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Decision */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
                Policy Rule
              </label>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-6 px-2 text-xs"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="w-full p-3 rounded-lg bg-mythos-bg-secondary border border-mythos-border-default text-sm text-mythos-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-mythos-accent-purple/50"
                rows={2}
                placeholder="Enter the policy rule..."
                data-testid="policy-pin-decision-input"
              />
            ) : (
              <div className="p-3 rounded-lg bg-mythos-bg-secondary border border-mythos-border-default">
                <p className="text-sm text-mythos-text-primary">{decision}</p>
              </div>
            )}
          </div>

          {/* Rationale */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
              Rationale
            </label>
            {isEditing ? (
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="w-full p-3 rounded-lg bg-mythos-bg-secondary border border-mythos-border-default text-sm text-mythos-text-secondary resize-none focus:outline-none focus:ring-2 focus:ring-mythos-accent-purple/50"
                rows={3}
                placeholder="Why is this policy important?"
                data-testid="policy-pin-rationale-input"
              />
            ) : (
              <div className="p-3 rounded-lg bg-mythos-bg-tertiary/30 border border-mythos-text-muted/10">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-mythos-text-muted flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-mythos-text-secondary leading-relaxed">
                    {rationale}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="p-3 rounded-lg bg-mythos-accent-purple/5 border border-mythos-accent-purple/20">
            <p className="text-xs text-mythos-text-muted">
              Pinned policies will be used by the AI to check your writing for compliance.
              You can manage pinned policies in the Project Graph.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2 pt-3 border-t border-mythos-border-default">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isPinning}
            data-testid="policy-pin-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPinning || !decision.trim()}
            className="bg-mythos-accent-purple hover:bg-mythos-accent-purple/90"
            data-testid="policy-pin-confirm"
          >
            {isPinning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Pinning...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Pin Policy
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
