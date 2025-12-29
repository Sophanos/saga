/**
 * ProgressiveNudge - Mobile nudge component for progressive disclosure
 *
 * Shows subtle, non-intrusive notifications when:
 * - Entities are detected in text (Phase 2)
 * - Consistency issues are found (Phase 3)
 * - Features become available to unlock (Phase 4)
 */

import { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import {
  useActiveNudge,
  useProgressiveStore,
  type EntityDiscoveryNudge,
  type ConsistencyChoiceNudge,
  type FeatureUnlockNudge,
} from "@mythos/state";

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300;
const NUDGE_WIDTH = Dimensions.get("window").width - 32; // 16px margin on each side

// ============================================================================
// Colors (matching Mythos theme)
// ============================================================================

const colors = {
  bgSecondary: "#18181b",
  borderSubtle: "#27272a",
  textPrimary: "#fafafa",
  textMuted: "#a1a1aa",
  accentCyan: "#22d3ee",
  accentCyanBg: "rgba(34, 211, 238, 0.2)",
  accentAmber: "#fbbf24",
  accentAmberBg: "rgba(251, 191, 36, 0.2)",
  accentPurple: "#a855f7",
  accentPurpleBg: "rgba(168, 85, 247, 0.2)",
  buttonBg: "#3f3f46",
  buttonHover: "#52525b",
};

// ============================================================================
// Entity Discovery Nudge Content
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
    <View style={styles.contentRow}>
      <View style={[styles.iconContainer, { backgroundColor: colors.accentCyanBg }]}>
        <Text style={[styles.iconText, { color: colors.accentCyan }]}>👥</Text>
      </View>
      <View style={styles.contentMain}>
        <Text style={styles.title}>Characters & places detected</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {topEntities.map((e) => e.name).join(", ")}
          {hasMore && ` +${totalCount - 3} more`}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={onTrack}>
            <Text style={styles.primaryButtonText}>Track these</Text>
            <Text style={styles.primaryButtonText}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
            <Text style={styles.secondaryButtonText}>Not now</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onNeverAsk} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Never ask</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// Consistency Choice Nudge Content
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
    <View style={styles.contentRow}>
      <View style={[styles.iconContainer, { backgroundColor: colors.accentAmberBg }]}>
        <Text style={[styles.iconText, { color: colors.accentAmber }]}>⚠️</Text>
      </View>
      <View style={styles.contentMain}>
        <Text style={styles.title}>Inconsistency detected</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {nudge.summary}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={onResolve}>
            <Text style={styles.primaryButtonText}>Resolve</Text>
            <Text style={styles.primaryButtonText}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
            <Text style={styles.secondaryButtonText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// Feature Unlock Nudge Content
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
    <View style={styles.contentRow}>
      <View style={[styles.iconContainer, { backgroundColor: colors.accentPurpleBg }]}>
        <Text style={[styles.iconText, { color: colors.accentPurple }]}>✨</Text>
      </View>
      <View style={styles.contentMain}>
        <Text style={styles.title}>New feature available</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {nudge.message}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={onUnlock}>
            <Text style={styles.primaryButtonText}>Enable</Text>
            <Text style={styles.primaryButtonText}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
            <Text style={styles.secondaryButtonText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// Main Progressive Nudge Component
// ============================================================================

export interface ProgressiveNudgeProps {
  /** Called when entity tracking is requested */
  onTrackEntities?: () => void;
  /** Called when consistency resolution is requested */
  onResolveConsistency?: (issueId: string) => void;
  /** Called when a feature unlock is requested */
  onUnlockFeature?: (module: string) => void;
}

export function ProgressiveNudge({
  onTrackEntities,
  onResolveConsistency,
  onUnlockFeature,
}: ProgressiveNudgeProps) {
  const nudge = useActiveNudge();
  const dismissNudge = useProgressiveStore((s) => s.dismissNudge);
  const unlockModule = useProgressiveStore((s) => s.unlockModule);

  // Animation value for slide-in
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate in when nudge appears
  useEffect(() => {
    if (nudge) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animation values when no nudge
      slideAnim.setValue(100);
      opacityAnim.setValue(0);
    }
  }, [nudge, slideAnim, opacityAnim]);

  const animateOut = useCallback(
    (callback: () => void) => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        callback();
      });
    },
    [slideAnim, opacityAnim]
  );

  const handleDismiss = useCallback(() => {
    if (nudge) {
      animateOut(() => dismissNudge(nudge.id));
    }
  }, [nudge, dismissNudge, animateOut]);

  const handleNeverAsk = useCallback(() => {
    if (nudge) {
      animateOut(() => dismissNudge(nudge.id, { neverAsk: true }));
    }
  }, [nudge, dismissNudge, animateOut]);

  const handleSnooze = useCallback(() => {
    if (nudge) {
      // Snooze for 5 minutes
      animateOut(() => dismissNudge(nudge.id, { snoozeMs: 5 * 60 * 1000 }));
    }
  }, [nudge, dismissNudge, animateOut]);

  const handleTrackEntities = useCallback(() => {
    if (nudge && nudge.type === "entity_discovery") {
      // Unlock manifest panel
      unlockModule(nudge.projectId, "manifest");
      unlockModule(nudge.projectId, "hud");
      onTrackEntities?.();
      animateOut(() => dismissNudge(nudge.id));
    }
  }, [nudge, unlockModule, onTrackEntities, dismissNudge, animateOut]);

  const handleResolveConsistency = useCallback(() => {
    if (nudge && nudge.type === "consistency_choice") {
      onResolveConsistency?.(nudge.issueId);
      animateOut(() => dismissNudge(nudge.id));
    }
  }, [nudge, onResolveConsistency, dismissNudge, animateOut]);

  const handleUnlockFeature = useCallback(() => {
    if (nudge && nudge.type === "feature_unlock") {
      unlockModule(nudge.projectId, nudge.module);
      onUnlockFeature?.(nudge.module);
      animateOut(() => dismissNudge(nudge.id));
    }
  }, [nudge, unlockModule, onUnlockFeature, dismissNudge, animateOut]);

  if (!nudge) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* Close button */}
      <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
        <Text style={styles.closeButtonText}>×</Text>
      </TouchableOpacity>

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
    </Animated.View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    width: NUDGE_WIDTH,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 1,
  },
  closeButtonText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "400",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  iconText: {
    fontSize: 14,
  },
  contentMain: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.buttonBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "500",
  },
  secondaryButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  linkButton: {
    marginLeft: "auto",
  },
  linkButtonText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

export default ProgressiveNudge;
