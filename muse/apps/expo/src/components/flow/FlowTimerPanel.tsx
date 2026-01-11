/**
 * FlowTimerPanel - Subtle, theme-based timer picker
 *
 * Notion-inspired design:
 * - Uses theme colors (accent blue, warm grays)
 * - Refined typography
 * - Subtle tick marks and indicators
 * - Elegant, minimal aesthetic
 */

import { useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography, shadows } from '@/design-system';
import { useFlowStore, useFlowTimer, formatFlowTime } from '@mythos/state';

const MIN_DURATION = 5;
const MAX_DURATION = 60;
const THRESHOLD_OPTIONS = [2, 5, 10];

interface FlowTimerPanelProps {
  onClose: () => void;
}

export function FlowTimerPanel({ onClose }: FlowTimerPanelProps) {
  const { colors, isDark } = useTheme();
  const timer = useFlowTimer();
  const startTimer = useFlowStore((s) => s.startTimer);
  const pauseTimer = useFlowStore((s) => s.pauseTimer);
  const resumeTimer = useFlowStore((s) => s.resumeTimer);
  const resetTimer = useFlowStore((s) => s.resetTimer);
  const setSelectedDuration = useFlowStore((s) => s.setSelectedDuration);
  const setRevealThreshold = useFlowStore((s) => s.setRevealThreshold);

  const railHeight = 280;
  const indicatorY = useSharedValue(0);

  // Calculate Y position from duration (60 at top, 5 at bottom)
  const durationToY = useCallback(
    (duration: number) => {
      const ratio = (MAX_DURATION - duration) / (MAX_DURATION - MIN_DURATION);
      return ratio * railHeight;
    },
    [railHeight]
  );

  // Calculate duration from Y position
  const yToDuration = useCallback(
    (y: number) => {
      const ratio = y / railHeight;
      const duration = MAX_DURATION - ratio * (MAX_DURATION - MIN_DURATION);
      return Math.round(Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration)) / 5) * 5;
    },
    [railHeight]
  );

  // Update indicator position when duration changes
  useEffect(() => {
    indicatorY.value = withSpring(durationToY(timer.selectedDurationMin), {
      damping: 25,
      stiffness: 300,
    });
  }, [timer.selectedDurationMin, durationToY, indicatorY]);

  // Handle drag gesture
  const panGesture = Gesture.Pan()
    .enabled(timer.state === 'idle')
    .onUpdate((e) => {
      const newY = Math.max(0, Math.min(railHeight, e.y));
      indicatorY.value = newY;
    })
    .onEnd((e) => {
      const newY = Math.max(0, Math.min(railHeight, e.y));
      const newDuration = yToDuration(newY);
      runOnJS(setSelectedDuration)(newDuration);
    });

  // Handle tap on rail
  const tapGesture = Gesture.Tap()
    .enabled(timer.state === 'idle')
    .onEnd((e) => {
      const newDuration = yToDuration(e.y);
      runOnJS(setSelectedDuration)(newDuration);
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // Timer controls
  const handleStart = useCallback(() => {
    startTimer();
    onClose();
  }, [startTimer, onClose]);

  const handlePause = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  const handleResume = useCallback(() => {
    resumeTimer();
    onClose();
  }, [resumeTimer, onClose]);

  const handleReset = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Cycle threshold
  const cycleThreshold = useCallback(() => {
    const currentIdx = THRESHOLD_OPTIONS.indexOf(timer.revealThresholdMin);
    const nextIdx = (currentIdx + 1) % THRESHOLD_OPTIONS.length;
    setRevealThreshold(THRESHOLD_OPTIONS[nextIdx]);
  }, [timer.revealThresholdMin, setRevealThreshold]);

  // Animated indicator
  const indicatorStyle = useAnimatedStyle(() => ({
    top: indicatorY.value - 1,
  }));

  // Generate tick marks
  const ticks = [];
  for (let min = MAX_DURATION; min >= MIN_DURATION; min -= 5) {
    const y = durationToY(min);
    const isSelected = min === timer.selectedDurationMin;
    const isThreshold = min === timer.revealThresholdMin;
    const isMajor = min % 15 === 0;

    ticks.push(
      <View key={min} style={[styles.tickRow, { top: y - 7 }]}>
        <View
          style={[
            styles.tick,
            {
              width: isMajor ? 12 : 8,
              backgroundColor: isSelected
                ? colors.accent
                : colors.borderSubtle,
            },
          ]}
        />
        <Animated.Text
          style={[
            styles.tickLabel,
            {
              color: isSelected ? colors.accent : colors.textMuted,
              opacity: isMajor || isSelected ? 1 : 0,
            },
          ]}
        >
          {min}
        </Animated.Text>
        {isThreshold && (
          <View style={[styles.thresholdDot, { backgroundColor: colors.textMuted }]} />
        )}
      </View>
    );
  }

  const displayValue = timer.state === 'idle'
    ? timer.selectedDurationMin
    : Math.ceil(timer.remainingSeconds / 60);

  const isRunning = timer.state === 'running';
  const isPaused = timer.state === 'paused';

  return (
    <Animated.View
      entering={SlideInLeft.duration(120).springify().damping(18).stiffness(400)}
      exiting={SlideOutLeft.duration(80)}
      style={[
        styles.container,
        {
          backgroundColor: colors.sidebarBg,
          borderRightColor: colors.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Animated.Text style={[styles.headerLabel, { color: colors.textMuted }]}>
          Timer
        </Animated.Text>
        <Pressable
          onPress={onClose}
          style={({ hovered }) => [
            styles.closeButton,
            { backgroundColor: hovered ? colors.bgHover : 'transparent' },
          ]}
        >
          <Feather name="x" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Duration display */}
      <View style={styles.displaySection}>
        <Animated.Text
          style={[
            styles.durationValue,
            {
              color: isRunning
                ? colors.accent
                : isPaused
                  ? colors.textSecondary
                  : colors.text,
            },
          ]}
        >
          {timer.state === 'idle' ? displayValue : formatFlowTime(timer.remainingSeconds)}
        </Animated.Text>
        {timer.state === 'idle' && (
          <Animated.Text style={[styles.durationUnit, { color: colors.textMuted }]}>
            minutes
          </Animated.Text>
        )}
      </View>

      {/* Vertical rail */}
      <GestureHandlerRootView style={styles.railWrapper}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.rail, { height: railHeight }]}>
            {/* Track line */}
            <View
              style={[
                styles.railTrack,
                { backgroundColor: colors.borderSubtle },
              ]}
            />

            {/* Ticks */}
            {ticks}

            {/* Indicator */}
            <Animated.View style={[styles.indicator, indicatorStyle]}>
              <View style={[styles.indicatorLine, { backgroundColor: colors.accent }]} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Controls */}
      <View style={styles.controls}>
        {timer.state === 'idle' && (
          <Pressable
            onPress={handleStart}
            style={({ pressed, hovered }) => [
              styles.primaryButton,
              {
                backgroundColor: pressed
                  ? colors.accentHover
                  : hovered
                    ? colors.accent
                    : colors.accentSubtle,
                borderColor: colors.accent,
              },
            ]}
          >
            <Feather
              name="play"
              size={16}
              color={colors.accent}
              style={{ marginLeft: 1 }}
            />
            <Animated.Text style={[styles.buttonLabel, { color: colors.accent }]}>
              Start
            </Animated.Text>
          </Pressable>
        )}

        {isRunning && (
          <Pressable
            onPress={handlePause}
            style={({ pressed, hovered }) => [
              styles.secondaryButton,
              {
                backgroundColor: hovered || pressed ? colors.bgHover : colors.bgActive,
              },
            ]}
          >
            <Feather name="pause" size={16} color={colors.text} />
            <Animated.Text style={[styles.buttonLabel, { color: colors.text }]}>
              Pause
            </Animated.Text>
          </Pressable>
        )}

        {isPaused && (
          <View style={styles.pausedControls}>
            <Pressable
              onPress={handleResume}
              style={({ pressed, hovered }) => [
                styles.primaryButton,
                { flex: 1 },
                {
                  backgroundColor: pressed
                    ? colors.accentHover
                    : hovered
                      ? colors.accent
                      : colors.accentSubtle,
                  borderColor: colors.accent,
                },
              ]}
            >
              <Feather name="play" size={14} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={handleReset}
              style={({ pressed, hovered }) => [
                styles.secondaryButton,
                { flex: 1 },
                {
                  backgroundColor: hovered || pressed ? colors.bgHover : colors.bgActive,
                },
              ]}
            >
              <Feather name="rotate-ccw" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Threshold setting */}
      <Pressable
        onPress={cycleThreshold}
        style={({ hovered }) => [
          styles.thresholdButton,
          { backgroundColor: hovered ? colors.bgHover : 'transparent' },
        ]}
      >
        <Animated.Text style={[styles.thresholdLabel, { color: colors.textMuted }]}>
          Auto-reveal at {timer.revealThresholdMin}m
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 120,
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    paddingHorizontal: spacing[3],
    borderRightWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  headerLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displaySection: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  durationValue: {
    fontSize: 32,
    fontWeight: typography.semibold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  durationUnit: {
    fontSize: typography.xs,
    marginTop: -2,
  },
  railWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  rail: {
    width: 60,
    position: 'relative',
  },
  railTrack: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 1,
  },
  tickRow: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
  },
  tick: {
    height: 1,
  },
  tickLabel: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing[1.5],
    width: 20,
  },
  thresholdDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginLeft: spacing[1],
  },
  indicator: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorLine: {
    width: 32,
    height: 2,
    borderRadius: 1,
  },
  controls: {
    marginTop: spacing[4],
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    height: 36,
    borderRadius: radii.md,
  },
  buttonLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  pausedControls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  thresholdButton: {
    marginTop: spacing[3],
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[2],
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  thresholdLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
});
