/**
 * CaptureFAB - Floating Action Button for Quick Capture
 *
 * A floating action button that appears on main screens to enable
 * quick capture of text, voice, photos, and flagged passages.
 */

import { useRef, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Plus } from "lucide-react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface CaptureFABProps {
  /**
   * Callback when FAB is pressed
   */
  onPress: () => void;
  /**
   * Whether the FAB is visible (defaults to true)
   */
  visible?: boolean;
  /**
   * Custom bottom offset (defaults to 24)
   */
  bottomOffset?: number;
}

/**
 * Floating action button for quick capture.
 *
 * Features:
 * - Bottom-right positioning with customizable offset
 * - Scale animation on press
 * - Show/hide animation
 * - Accessibility labels
 */
export function CaptureFAB({
  onPress,
  visible = true,
  bottomOffset = 24,
}: CaptureFABProps) {
  // Animation values
  const scale = useSharedValue(1);
  const visibility = useSharedValue(visible ? 1 : 0);
  const rotation = useSharedValue(0);

  // Update visibility animation when prop changes
  useEffect(() => {
    visibility.value = withSpring(visible ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [visible, visibility]);

  // Press handlers for scale animation
  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    rotation.value = withSpring(45, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    rotation.value = withSpring(0, { damping: 15, stiffness: 200 });
  };

  // Animated styles for the FAB
  const animatedStyle = useAnimatedStyle(() => {
    const scaleVal = scale.value * visibility.value;
    const translateYVal = interpolate(visibility.value, [0, 1], [100, 0], Extrapolation.CLAMP);
    return {
      transform: [
        { scale: scaleVal },
        { translateY: translateYVal },
      ] as const,
      opacity: visibility.value,
    };
  });

  // Animated style for the icon rotation
  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  if (!visible && visibility.value === 0) {
    return null;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.fab, { bottom: bottomOffset }, animatedStyle]}
      accessibilityLabel="Quick capture"
      accessibilityHint="Open capture menu to add text, voice, or photo notes"
      accessibilityRole="button"
    >
      <View style={styles.fabInner}>
        <Animated.View style={iconAnimatedStyle}>
          <Plus size={28} color="#0a0a0f" strokeWidth={2.5} />
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 24,
    zIndex: 100,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#22d3ee", // accent cyan
    alignItems: "center",
    justifyContent: "center",
    // Shadow for iOS
    shadowColor: "#22d3ee",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 8,
  },
});

export default CaptureFAB;
