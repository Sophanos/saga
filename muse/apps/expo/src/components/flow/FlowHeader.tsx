/**
 * FlowHeader - Minimal header for flow mode (Expo)
 *
 * Clean, distraction-free header with:
 * - Timer display (left) - clickable to open timer panel
 * - Word count (center)
 * - Focus level toggle + Exit (right)
 */

import { useCallback } from 'react';
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
  useSessionWordsWritten,
  useFlowPreferences,
  useShouldAutoReveal,
  formatFlowTime,
  type FocusLevel,
} from '@mythos/state';
import { useEffect } from 'react';

interface FlowHeaderProps {
  onExit: () => void;
  onTimerPress: () => void;
}

export function FlowHeader({ onExit, onTimerPress }: FlowHeaderProps) {
  const { colors, isDark } = useTheme();
  const timer = useFlowTimer();
  const focusLevel = useFocusLevel();
  const wordsWritten = useSessionWordsWritten();
  const preferences = useFlowPreferences();
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

  // Focus level cycling
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

  // Word goal progress
  const goalProgress = preferences.sessionWordGoal
    ? Math.min(100, (wordsWritten / preferences.sessionWordGoal) * 100)
    : null;

  // Timer display text
  const getTimerDisplay = () => {
    if (timer.state === 'idle') {
      return `${timer.selectedDurationMin}m`;
    }
    return formatFlowTime(timer.remainingSeconds);
  };

  // Timer color
  const getTimerColor = () => {
    if (timer.state === 'running') return '#22c55e';
    if (timer.state === 'break') return '#f59e0b';
    if (timer.state === 'paused') return '#f59e0b';
    return colors.textSecondary;
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.container, { borderBottomColor: colors.borderSubtle }]}
    >
      {/* Left: Timer display (clickable) */}
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
          <Feather
            name="clock"
            size={14}
            color={getTimerColor()}
          />
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

      {/* Center: Word count */}
      <View style={styles.centerSection}>
        <Text style={[styles.wordCountValue, { color: colors.text }]}>
          {wordsWritten.toLocaleString()}
        </Text>
        <Text style={[styles.wordCountLabel, { color: colors.textMuted }]}>
          words
        </Text>
        {goalProgress !== null && (
          <View style={[styles.goalBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <View
              style={[
                styles.goalProgress,
                {
                  width: `${goalProgress}%`,
                  backgroundColor: goalProgress >= 100 ? '#22c55e' : '#22d3ee',
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* Right: Focus toggle + Exit */}
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
          <Feather name={focusConfig.icon} size={14} color={colors.textSecondary} />
          <Text style={[styles.focusLabel, { color: colors.textSecondary }]}>
            {focusConfig.label}
          </Text>
        </Pressable>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

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
          <Feather name="x" size={18} color={colors.textSecondary} />
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
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    borderRadius: radii.sm,
  },
  timerText: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    fontWeight: '600',
  },
  runningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  centerSection: {
    alignItems: 'center',
    gap: spacing[0.5],
  },
  wordCountValue: {
    fontFamily: 'SpaceMono',
    fontSize: typography['2xl'],
    fontWeight: '700',
    letterSpacing: -1,
  },
  wordCountLabel: {
    fontSize: typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  goalBar: {
    width: 80,
    height: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
    marginTop: spacing[1],
  },
  goalProgress: {
    height: '100%',
    borderRadius: radii.full,
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  focusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    borderRadius: radii.sm,
  },
  focusLabel: {
    fontSize: typography.xs,
  },
  divider: {
    width: 1,
    height: 20,
  },
  exitButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
