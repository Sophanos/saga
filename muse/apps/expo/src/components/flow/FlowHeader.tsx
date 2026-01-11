/**
 * FlowHeader - Minimal top bar for flow mode (Expo)
 *
 * Contains timer, word counter, focus controls, and exit button.
 * Designed to be unobtrusive while providing essential information.
 */

import { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import {
  useFlowStore,
  useFlowTimer,
  useFlowPreferences,
  useFocusLevel,
  useSessionWordsWritten,
  formatFlowTime,
  type FocusLevel,
} from '@mythos/state';

interface FlowHeaderProps {
  onExit: () => void;
}

export function FlowHeader({ onExit }: FlowHeaderProps) {
  const { colors, isDark } = useTheme();
  const timer = useFlowTimer();
  const preferences = useFlowPreferences();
  const focusLevel = useFocusLevel();
  const wordsWritten = useSessionWordsWritten();

  const startTimer = useFlowStore((s) => s.startTimer);
  const pauseTimer = useFlowStore((s) => s.pauseTimer);
  const resumeTimer = useFlowStore((s) => s.resumeTimer);
  const resetTimer = useFlowStore((s) => s.resetTimer);
  const skipBreak = useFlowStore((s) => s.skipBreak);
  const tickTimer = useFlowStore((s) => s.tickTimer);
  const setFocusLevel = useFlowStore((s) => s.setFocusLevel);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Breathing animation for timer
  const breatheOpacity = useSharedValue(1);

  useEffect(() => {
    if (timer.state === 'running') {
      breatheOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 2000 }),
          withTiming(1, { duration: 2000 })
        ),
        -1,
        false
      );
    } else {
      breatheOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [timer.state, breatheOpacity]);

  // Timer tick effect
  useEffect(() => {
    if (timer.state === 'running' || timer.state === 'break') {
      intervalRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timer.state, tickTimer]);

  // Timer controls
  const handleTimerToggle = useCallback(() => {
    if (timer.state === 'idle') {
      startTimer();
    } else if (timer.state === 'running') {
      pauseTimer();
    } else if (timer.state === 'paused') {
      resumeTimer();
    } else if (timer.state === 'break') {
      skipBreak();
    }
  }, [timer.state, startTimer, pauseTimer, resumeTimer, skipBreak]);

  // Focus level cycling
  const cycleFocusLevel = useCallback(() => {
    const levels: FocusLevel[] = ['none', 'sentence', 'paragraph'];
    const currentIdx = levels.indexOf(focusLevel);
    const nextIdx = (currentIdx + 1) % levels.length;
    setFocusLevel(levels[nextIdx]);
  }, [focusLevel, setFocusLevel]);

  // Timer color based on state
  const getTimerColor = () => {
    if (timer.isBreak) return '#22d3ee'; // cyan
    if (timer.state === 'running') {
      if (timer.remainingSeconds <= 60) return '#ef4444'; // red
      if (timer.remainingSeconds <= 300) return '#f59e0b'; // amber
      return '#22c55e'; // green
    }
    return colors.textMuted;
  };

  // Focus icon name
  const getFocusIconName = (): keyof typeof Feather.glyphMap => {
    if (focusLevel === 'sentence') return 'type';
    if (focusLevel === 'paragraph') return 'align-left';
    return 'minus';
  };

  // Word goal progress
  const goalProgress = preferences.sessionWordGoal
    ? Math.min(100, (wordsWritten / preferences.sessionWordGoal) * 100)
    : null;

  const breatheStyle = useAnimatedStyle(() => ({
    opacity: breatheOpacity.value,
  }));

  return (
    <View style={[styles.container, { borderBottomColor: colors.borderSubtle }]}>
      {/* Left: Timer */}
      <View style={styles.leftSection}>
        {/* Timer display */}
        <Animated.View
          style={[
            styles.timerContainer,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
            breatheStyle,
          ]}
        >
          <Feather
            name={timer.isBreak ? 'coffee' : 'target'}
            size={14}
            color={timer.isBreak ? '#22d3ee' : colors.textMuted}
          />
          <Text style={[styles.timerText, { color: getTimerColor() }]}>
            {formatFlowTime(timer.remainingSeconds)}
          </Text>
        </Animated.View>

        {/* Timer controls */}
        <View style={styles.timerControls}>
          <Pressable
            onPress={handleTimerToggle}
            style={({ pressed, hovered }) => [
              styles.iconButton,
              {
                backgroundColor: hovered || pressed
                  ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  : 'transparent',
              },
            ]}
          >
            <Feather
              name={timer.state === 'running' || timer.state === 'break' ? 'pause' : 'play'}
              size={14}
              color={colors.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={resetTimer}
            style={({ pressed, hovered }) => [
              styles.iconButton,
              {
                backgroundColor: hovered || pressed
                  ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  : 'transparent',
              },
            ]}
          >
            <Feather name="rotate-ccw" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Center: Word count & goal */}
      <View style={styles.centerSection}>
        <View style={styles.wordCountRow}>
          <Text style={[styles.wordCountValue, { color: colors.text }]}>
            {wordsWritten.toLocaleString()}
          </Text>
          <Text style={[styles.wordCountLabel, { color: colors.textSecondary }]}> words</Text>
          {preferences.sessionWordGoal && (
            <Text style={[styles.goalText, { color: colors.textMuted }]}>
              {' '}/ {preferences.sessionWordGoal.toLocaleString()}
            </Text>
          )}
        </View>
        {goalProgress !== null && (
          <View style={[styles.goalBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <View
              style={[
                styles.goalProgress,
                { width: `${goalProgress}%` },
              ]}
            />
          </View>
        )}
      </View>

      {/* Right: Focus controls & exit */}
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
          <Feather name={getFocusIconName()} size={14} color={colors.textSecondary} />
          <Text style={[styles.focusLabel, { color: colors.textSecondary }]}>
            {focusLevel === 'none' ? 'Off' : focusLevel}
          </Text>
        </Pressable>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        {/* Exit button */}
        <Pressable
          onPress={onExit}
          style={({ pressed, hovered }) => [
            styles.iconButton,
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
  },
  timerText: {
    fontFamily: 'SpaceMono',
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSection: {
    alignItems: 'center',
    gap: spacing[1],
  },
  wordCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  wordCountValue: {
    fontFamily: 'SpaceMono',
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  wordCountLabel: {
    fontSize: typography.sm,
  },
  goalText: {
    fontSize: typography.xs,
  },
  goalBar: {
    width: 120,
    height: 3,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  goalProgress: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: '#22d3ee',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
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
    textTransform: 'capitalize',
  },
  divider: {
    width: 1,
    height: 20,
  },
});
