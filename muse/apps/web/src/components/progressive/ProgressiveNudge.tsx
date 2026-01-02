/**
 * ProgressiveNudge - Renders nudges for progressive disclosure
 * 
 * Shows subtle, non-intrusive notifications when:
 * - Entities are detected in text (Phase 2)
 * - Consistency issues are found (Phase 3)
 * - Features become available to unlock (Phase 4)
 */

import { useMemo } from "react";
import { X, Users, AlertTriangle, Sparkles, ChevronRight } from "lucide-react";
import { Button, cn } from "@mythos/ui";
import {
  useActiveNudge,
  useProgressiveNudgeActions,
  type EntityDiscoveryNudge,
  type ConsistencyChoiceNudge,
  type FeatureUnlockNudge,
} from "@mythos/state";

// ============================================================================
// Entity Discovery Nudge
// ============================================================================

interface EntityNudgeContentProps {
  nudge: EntityDiscoveryNudge;
  onTrack: () => void;
  onDismiss: () => void;
  onNeverAsk: () => void;
}

function EntityNudgeContent({
  nudge,
  onTrack,
  onDismiss,
  onNeverAsk,
}: EntityNudgeContentProps) {
  // Show top 3 entities by count
  const topEntities = [...nudge.entities]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const totalCount = nudge.entities.length;
  const hasMore = totalCount > 3;

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mythos-accent-primary/20 flex items-center justify-center">
        <Users className="w-4 h-4 text-mythos-accent-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mythos-text-primary mb-1">
          Characters & places detected
        </p>
        <p className="text-xs text-mythos-text-muted mb-2">
          {topEntities.map((e) => e.name).join(", ")}
          {hasMore && ` +${totalCount - 3} more`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onTrack}
            className="h-7 px-3 text-xs gap-1"
          >
            Track these
            <ChevronRight className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-7 px-2 text-xs text-mythos-text-muted"
          >
            Not now
          </Button>
          <button
            onClick={onNeverAsk}
            className="text-xs text-mythos-text-muted hover:text-mythos-text-secondary ml-auto"
          >
            Never ask
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Consistency Choice Nudge
// ============================================================================

interface ConsistencyNudgeContentProps {
  nudge: ConsistencyChoiceNudge;
  onResolve: () => void;
  onDismiss: () => void;
}

function ConsistencyNudgeContent({
  nudge,
  onResolve,
  onDismiss,
}: ConsistencyNudgeContentProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mythos-accent-amber/20 flex items-center justify-center">
        <AlertTriangle className="w-4 h-4 text-mythos-accent-amber" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mythos-text-primary mb-1">
          Inconsistency detected
        </p>
        <p className="text-xs text-mythos-text-muted mb-2 line-clamp-2">
          {nudge.summary}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onResolve}
            className="h-7 px-3 text-xs gap-1"
          >
            Resolve
            <ChevronRight className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-7 px-2 text-xs text-mythos-text-muted"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Feature Unlock Nudge
// ============================================================================

interface FeatureNudgeContentProps {
  nudge: FeatureUnlockNudge;
  onUnlock: () => void;
  onDismiss: () => void;
}

function FeatureNudgeContent({
  nudge,
  onUnlock,
  onDismiss,
}: FeatureNudgeContentProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-mythos-accent-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mythos-text-primary mb-1">
          New feature available
        </p>
        <p className="text-xs text-mythos-text-muted mb-2">
          {nudge.message}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onUnlock}
            className="h-7 px-3 text-xs gap-1"
          >
            Enable
            <ChevronRight className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-7 px-2 text-xs text-mythos-text-muted"
          >
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Nudge Component
// ============================================================================

export interface ProgressiveNudgeProps {
  /** Called when entity tracking is requested */
  onTrackEntities?: () => void;
  /** Called when consistency resolution is requested */
  onResolveConsistency?: (issueId: string) => void;
  /** Called when a feature unlock is requested */
  onUnlockFeature?: (module: string) => void;
  className?: string;
}

export function ProgressiveNudge({
  onTrackEntities,
  onResolveConsistency,
  onUnlockFeature,
  className,
}: ProgressiveNudgeProps) {
  const nudge = useActiveNudge();

  // Memoize options to prevent unnecessary re-renders of the shared hook
  const nudgeActionOptions = useMemo(
    () => ({
      onTrackEntities,
      onResolveConsistency,
      onUnlockFeature,
      // No onAnimateOut for web - CSS handles animations
    }),
    [onTrackEntities, onResolveConsistency, onUnlockFeature]
  );

  // Use shared hook for all nudge actions
  const {
    handleTrackEntities,
    handleResolveConsistency,
    handleUnlockFeature,
    handleDismiss,
    handleNeverAsk,
    handleSnooze,
  } = useProgressiveNudgeActions(nudgeActionOptions);

  if (!nudge) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm",
        "bg-mythos-bg-secondary border border-mythos-border-subtle rounded-lg shadow-lg",
        "p-4 animate-in slide-in-from-bottom-4 fade-in duration-300",
        className
      )}
    >
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-mythos-text-muted hover:text-mythos-text-secondary rounded"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Render appropriate content based on nudge type */}
      {nudge.type === "entity_discovery" && (
        <EntityNudgeContent
          nudge={nudge}
          onTrack={handleTrackEntities}
          onDismiss={handleSnooze}
          onNeverAsk={handleNeverAsk}
        />
      )}
      {nudge.type === "consistency_choice" && (
        <ConsistencyNudgeContent
          nudge={nudge}
          onResolve={handleResolveConsistency}
          onDismiss={handleDismiss}
        />
      )}
      {nudge.type === "feature_unlock" && (
        <FeatureNudgeContent
          nudge={nudge}
          onUnlock={handleUnlockFeature}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

export default ProgressiveNudge;
