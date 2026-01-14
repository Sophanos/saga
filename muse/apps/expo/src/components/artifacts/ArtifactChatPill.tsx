/**
 * ArtifactChatPill - Collapsible wrapper that expands into AIPanelInput
 *
 * Collapsed: Small pill "Refine artifact..."
 * Expanded: Full AIPanelInput chatbar (centered) + hide icon top-right of history
 *
 * Behavior:
 * - ESC closes (double ESC if text in input)
 * - Inactivity timeout closes (if no text)
 * - History fades out naturally after chatbar closes
 * - Text in input prevents auto-close
 */

import { useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTheme, spacing, radii, typography } from "@/design-system";
import { useArtifactStore, useAIStore } from "@mythos/state";
import { AIPanelInput } from "../ai/AIPanelInput";

interface ArtifactChatPillProps {
  onSubmit: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SOFT_SPRING = { damping: 20, stiffness: 180 };
const INACTIVITY_TIMEOUT = 8000;
const ESC_DOUBLE_TAP_WINDOW = 500;

export function ArtifactChatPill({
  onSubmit,
  placeholder = "Refine artifact...",
  disabled = false,
}: ArtifactChatPillProps) {
  const { colors, isDark } = useTheme();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEscTime = useRef<number>(0);

  // Centralized state
  const {
    iterationPillExpanded,
    iterationHistoryVisible,
    setIterationPillExpanded,
    setIterationHistoryVisible,
  } = useArtifactStore();
  const { inputValue } = useAIStore();

  // Animation values
  const hoverLift = useSharedValue(0);
  const breathe = useSharedValue(0);
  const collapsedOpacity = useSharedValue(iterationPillExpanded ? 0 : 1);
  // Single value for both expanded chatbar and history - ensures perfect sync
  const contentOpacity = useSharedValue(iterationPillExpanded ? 1 : 0);
  const hideIconOpacity = useSharedValue(0);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (iterationPillExpanded && !inputValue.trim()) {
      inactivityTimer.current = setTimeout(() => {
        setIterationPillExpanded(false);
      }, INACTIVITY_TIMEOUT);
    }
  }, [iterationPillExpanded, inputValue, setIterationPillExpanded]);

  // Handle ESC - double tap required if text exists
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && iterationPillExpanded) {
        const now = Date.now();
        const hasText = inputValue.trim().length > 0;

        if (hasText) {
          if (now - lastEscTime.current < ESC_DOUBLE_TAP_WINDOW) {
            setIterationPillExpanded(false);
            lastEscTime.current = 0;
          } else {
            lastEscTime.current = now;
          }
        } else {
          setIterationPillExpanded(false);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [iterationPillExpanded, inputValue, setIterationPillExpanded]);

  // Inactivity timer management
  useEffect(() => {
    if (iterationPillExpanded) {
      resetInactivityTimer();
    } else if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [iterationPillExpanded, resetInactivityTimer]);

  // Clear timer when user types
  useEffect(() => {
    if (inputValue.trim()) {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    } else if (iterationPillExpanded) {
      resetInactivityTimer();
    }
  }, [inputValue, iterationPillExpanded, resetInactivityTimer]);

  // Sync animations with state - single contentOpacity for perfect sync
  useEffect(() => {
    if (iterationPillExpanded) {
      setIterationHistoryVisible(true);
      collapsedOpacity.value = withTiming(0, { duration: 100 });
      contentOpacity.value = withDelay(60, withTiming(1, { duration: 200 }));
      hideIconOpacity.value = withDelay(300, withTiming(0.35, { duration: 300 }));
    } else {
      // Fade out chatbar and history together - single animation
      const fadeDuration = 350;
      contentOpacity.value = withTiming(0, { duration: fadeDuration, easing: Easing.out(Easing.cubic) });
      hideIconOpacity.value = withTiming(0, { duration: 150 });
      // Show collapsed pill after fade
      collapsedOpacity.value = withDelay(fadeDuration - 80, withTiming(1, { duration: 180 }));
      // Update visibility state after animation
      setTimeout(() => setIterationHistoryVisible(false), fadeDuration);
    }
  }, [iterationPillExpanded, setIterationHistoryVisible]);

  // Gentle idle breathing
  useEffect(() => {
    if (!iterationPillExpanded && !disabled) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(breathe);
      breathe.value = withTiming(0, { duration: 200 });
    }
  }, [iterationPillExpanded, disabled]);

  // Hover
  const handleHoverIn = () => {
    if (iterationPillExpanded || disabled) return;
    hoverLift.value = withSpring(1, { damping: 15, stiffness: 200 });
    // Show history on hover
    setIterationHistoryVisible(true);
    contentOpacity.value = withTiming(1, { duration: 200 });
  };

  const handleHoverOut = () => {
    if (iterationPillExpanded) return;
    hoverLift.value = withSpring(0, SOFT_SPRING);
  };

  // Open
  const handleOpen = () => {
    if (iterationPillExpanded || disabled) return;
    setIterationPillExpanded(true);
  };

  // Close
  const handleClose = () => {
    setIterationPillExpanded(false);
  };

  // Hide icon hover
  const handleHideHoverIn = () => {
    hideIconOpacity.value = withTiming(0.7, { duration: 150 });
  };

  const handleHideHoverOut = () => {
    hideIconOpacity.value = withTiming(0.35, { duration: 150 });
  };

  // Animated styles
  const pillStyle = useAnimatedStyle(() => {
    const breatheScale = interpolate(breathe.value, [0, 1], [1, 1.008]);
    const liftY = interpolate(hoverLift.value, [0, 1], [0, -3]);

    return {
      transform: [{ translateY: liftY }, { scale: breatheScale }],
      opacity: collapsedOpacity.value,
    };
  });

  // Both chatbar and history use same opacity for perfect sync
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [
      { scale: interpolate(contentOpacity.value, [0, 1], [0.97, 1]) },
    ],
  }));

  const hideIconStyle = useAnimatedStyle(() => ({
    opacity: hideIconOpacity.value,
  }));

  return {
    wrapper: styles.wrapper,
    pillComponent: (
      <View style={styles.pillWrapper}>
        {/* Collapsed pill */}
        {!iterationPillExpanded && (
          <Pressable
            onPress={handleOpen}
            onHoverIn={handleHoverIn}
            onHoverOut={handleHoverOut}
            disabled={disabled}
          >
            <Animated.View
              style={[
                styles.pill,
                pillStyle,
                {
                  backgroundColor: colors.bgElevated,
                  borderColor: colors.border,
                  shadowColor: isDark ? '#000' : '#666',
                },
              ]}
            >
              <Text style={[styles.placeholder, { color: colors.textMuted }]}>
                {placeholder}
              </Text>
              <View style={[styles.arrowBg, { backgroundColor: colors.bgHover }]}>
                <Feather name="arrow-up" size={14} color={colors.textMuted} />
              </View>
            </Animated.View>
          </Pressable>
        )}

        {/* Expanded: Full AIPanelInput centered */}
        {iterationPillExpanded && (
          <Animated.View style={[styles.expanded, contentStyle]}>
            <AIPanelInput
              onSend={onSubmit}
              placeholder="Refine this artifact..."
              hideGradient
            />
          </Animated.View>
        )}
      </View>
    ),
    contentStyle,
    iterationHistoryVisible,
    hideButton: iterationPillExpanded ? (
      <Pressable
        onPress={handleClose}
        onHoverIn={handleHideHoverIn}
        onHoverOut={handleHideHoverOut}
        style={styles.hideButtonTopRight}
      >
        <Animated.View style={hideIconStyle}>
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
    ) : null,
  };
}

// Wrapper component for use in ArtifactPanel
export function ArtifactChatPillContainer({
  onSubmit,
  placeholder,
  disabled,
  children,
}: ArtifactChatPillProps & { children?: React.ReactNode }) {
  const result = ArtifactChatPill({ onSubmit, placeholder, disabled });

  return (
    <View style={result.wrapper}>
      {/* History with hide button top-right - uses same contentStyle for perfect sync */}
      {children && (
        <View style={styles.historySection}>
          <Animated.View style={[styles.historyContent, result.contentStyle]}>
            {result.iterationHistoryVisible && children}
          </Animated.View>
          {result.hideButton}
        </View>
      )}
      {result.pillComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  historySection: {
    position: 'relative',
  },
  historyContent: {
    flex: 1,
  },
  hideButtonTopRight: {
    position: 'absolute',
    top: -8,
    right: -4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillWrapper: {
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 180,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  placeholder: {
    fontSize: typography.sm,
    fontWeight: typography.medium as any,
  },
  arrowBg: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expanded: {
    width: '100%',
  },
});
