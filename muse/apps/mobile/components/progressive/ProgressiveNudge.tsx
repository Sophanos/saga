/**
 * ProgressiveNudge - Mobile nudge component for progressive disclosure
 *
 * Shows subtle, non-intrusive notifications when:
 * - Entities are detected in text (Phase 2)
 * - Consistency issues are found (Phase 3)
 * - Features become available to unlock (Phase 4)
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
  useProgressiveNudgeActions,
  type EntityDiscoveryNudge,
  type ConsistencyChoiceNudge,
  type FeatureUnlockNudge,
} from "@mythos/state";
import { neutral, accent, text } from "@mythos/theme";

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 300;
const HORIZONTAL_MARGIN = 16; // margin on each side

/** Calculate nudge width based on window dimensions */
function calculateNudgeWidth(): number {
  return Dimensions.get("window").width - HORIZONTAL_MARGIN * 2;
}

// ============================================================================
// Colors (from @mythos/theme)
// ============================================================================

const colors = {
  bgSecondary: neutral[900],
  borderSubtle: neutral[800],
  textPrimary: neutral[50],
  textMuted: text.secondary,
  accentCyan: accent.cyan,
  accentCyanBg: `${accent.cyan}33`, // 20% opacity
  accentAmber: accent.amber,
  accentAmberBg: `${accent.amber}33`, // 20% opacity
  accentPurple: accent.purple,
  accentPurpleBg: `${accent.purple}33`, // 20% opacity
  buttonBg: neutral[700],
  buttonHover: neutral[600],
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

  // Responsive width state
  const [nudgeWidth, setNudgeWidth] = useState(calculateNudgeWidth);

  // Animation value for slide-in
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Update width on dimension changes (e.g., rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      setNudgeWidth(calculateNudgeWidth());
    });
    return () => subscription.remove();
  }, []);

  // Animate in when nudge appears, with cleanup on unmount
  useEffect(() => {
    let animations: Animated.CompositeAnimation | null = null;
    if (nudge) {
      animations = Animated.parallel([
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
      ]);
      animations.start();
    } else {
      // Reset animation values when no nudge
      slideAnim.setValue(100);
      opacityAnim.setValue(0);
    }
    return () => {
      animations?.stop();
    };
  }, [nudge, slideAnim, opacityAnim]);

  // Animation out callback for the shared hook
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

  // Memoize options to prevent unnecessary re-renders of the shared hook
  const nudgeActionOptions = useMemo(
    () => ({
      onTrackEntities,
      onResolveConsistency,
      onUnlockFeature,
      onAnimateOut: animateOut,
    }),
    [onTrackEntities, onResolveConsistency, onUnlockFeature, animateOut]
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
    <Animated.View
      style={[
        styles.container,
        {
          width: nudgeWidth,
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
    left: HORIZONTAL_MARGIN,
    right: HORIZONTAL_MARGIN,
    // width is set dynamically via nudgeWidth state for responsiveness
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
