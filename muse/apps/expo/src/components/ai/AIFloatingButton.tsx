/**
 * AIFloatingButton - Floating action button to open AI panel
 * Notion-inspired with Muse persona avatar
 */

import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme, spacing, sizing, radii, shadows } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import { MuseAvatar } from './MuseAvatar';

interface AIFloatingButtonProps {
  hasUnread?: boolean;
}

export function AIFloatingButton({ hasUnread = false }: AIFloatingButtonProps) {
  const { colors } = useTheme();
  const { aiPanelMode, setAIPanelMode } = useLayoutStore();

  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  // Pulse animation for unread indicator
  useEffect(() => {
    if (hasUnread) {
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        false
      );
    } else {
      ringScale.value = withSpring(1);
      ringOpacity.value = withTiming(0);
    }
  }, [hasUnread, ringScale, ringOpacity]);

  const handlePressIn = () => {
    scale.value = withSpring(0.92);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    setAIPanelMode(aiPanelMode === 'hidden' ? 'sticky' : 'hidden');
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  // Only show when panel is hidden
  if (aiPanelMode !== 'hidden') {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      {/* Pulse ring for unread */}
      {hasUnread && (
        <Animated.View
          style={[
            styles.ring,
            ringStyle,
            { borderColor: colors.accent },
          ]}
        />
      )}

      {/* Main button */}
      <Animated.View style={buttonStyle}>
        <Pressable
          style={[
            styles.button,
            shadows.lg,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <MuseAvatar size="fab" />
        </Pressable>
      </Animated.View>

      {/* Unread badge */}
      {hasUnread && (
        <Animated.View
          entering={FadeIn}
          style={[styles.badge, { backgroundColor: colors.accent }]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing[6],
    bottom: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: sizing.aiFabSize + 16,
    height: sizing.aiFabSize + 16,
    borderRadius: radii.full,
    borderWidth: 2,
  },
  button: {
    width: sizing.aiFabSize,
    height: sizing.aiFabSize,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
