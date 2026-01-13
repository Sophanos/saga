/**
 * FlowHeader - Minimal header for flow mode (Expo)
 *
 * Ultra-minimal design:
 * - Timer display (left) - clickable to open timer panel
 * - Focus level toggle + Exit (right)
 * - Word count moved to bottom-left of overlay
 */

import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import {
  useFlowStore,
  useFlowTimer,
  useFocusLevel,
  useShouldAutoReveal,
  formatFlowTime,
  type FocusLevel,
} from '@mythos/state';

interface FlowHeaderProps {
  onExit: () => void;
  onTimerPress: () => void;
}

export function FlowHeader({ onExit, onTimerPress }: FlowHeaderProps) {
  const { colors, isDark } = useTheme();
  const timer = useFlowTimer();
  const focusLevel = useFocusLevel();
  const shouldAutoReveal = useShouldAutoReveal();
  const setFocusLevel = useFlowStore((s) => s.setFocusLevel);

  // Pulsing animation for auto-reveal indicator
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (shouldAutoReveal && (timer.state === 'running' || timer.state === 'break')) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1, // infinite
        false
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [shouldAutoReveal, timer.state, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const cycleFocusLevel = useCallback(() => {
    const levels: FocusLevel[] = ['none', 'sentence', 'paragraph'];
    const currentIdx = levels.indexOf(focusLevel);
    const nextIdx = (currentIdx + 1) % levels.length;
    setFocusLevel(levels[nextIdx]);
  }, [focusLevel, setFocusLevel]);

  // Focus icon and label
  const getFocusConfig = () => {
    switch (focusLevel) {
      case 'sentence':
        return { icon: 'type' as const, label: 'Sentence' };
      case 'paragraph':
        return { icon: 'align-left' as const, label: 'Paragraph' };
      default:
        return { icon: 'minus' as const, label: 'Off' };
    }
  };

  const focusConfig = getFocusConfig();

  // Timer display text
  const getTimerDisplay = () => {
    if (timer.state === 'idle') {
      return `${timer.selectedDurationMin}m`;
    }
    return formatFlowTime(timer.remainingSeconds);
  };

  // Timer color - more subtle
  const getTimerColor = () => {
    if (timer.state === 'running') return '#22c55e';
    if (timer.state === 'break') return '#f59e0b';
    if (timer.state === 'paused') return '#f59e0b';
    return colors.textMuted;
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      {/* Left: Timer display (clickable) - minimal */}
      <View style={styles.leftSection}>
        <Pressable
          onPress={onTimerPress}
          style={({ pressed, hovered }) => [
            styles.timerButton,
            {
              backgroundColor: hovered || pressed
                ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                : 'transparent',
            },
          ]}
        >
          <Text style={[styles.timerText, { color: getTimerColor() }]}>
            {getTimerDisplay()}
          </Text>
          {(timer.state === 'running' || timer.state === 'break') && (
            <Animated.View
              style={[
                styles.runningDot,
                shouldAutoReveal && pulseStyle,
                {
                  backgroundColor: timer.state === 'break' ? '#f59e0b' : '#22c55e',
                },
              ]}
            />
          )}
        </Pressable>
      </View>

      {/* Right: Focus toggle + Exit - minimal */}
      <View style={styles.rightSection}>
        {/* Focus level toggle */}
        <Pressable
          onPress={cycleFocusLevel}
          style={({ pressed, hovered }) => [
            styles.focusButton,
            {
              backgroundColor: hovered || pressed
                ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                : 'transparent',
            },
          ]}
        >
          <Feather name={focusConfig.icon} size={14} color={colors.textMuted} />
          <Text style={[styles.focusLabel, { color: colors.textMuted }]}>
            {focusConfig.label}
          </Text>
        </Pressable>

        {/* Exit button */}
        <Pressable
          onPress={onExit}
          style={({ pressed, hovered }) => [
            styles.exitButton,
            {
              backgroundColor: hovered || pressed
                ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                : 'transparent',
            },
          ]}
        >
          <Feather name="x" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  leftSection: {
    alignItems: 'flex-start',
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.sm,
  },
  timerText: {
    fontFamily: 'SpaceMono',
    fontSize: 13,
    fontWeight: '500',
  },
  runningDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22c55e',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.sm,
  },
  focusLabel: {
    fontSize: typography.xs,
  },
  exitButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
