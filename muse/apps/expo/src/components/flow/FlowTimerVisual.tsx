/**
 * FlowTimerVisual - Vertical rail timer with auto-reveal
 *
 * Features:
 * - Vertical tick rail (5-60 minutes)
 * - Setup mode: full rail with drag/click to select duration
 * - Running mode: hidden by default, auto-reveals at threshold
 * - Long-press on 2/5/10 tick to set reveal threshold
 * - Click to manually reveal when running
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '@/design-system';
import {
  useFlowStore,
  useFlowTimer,
  formatFlowTime,
} from '@mythos/state';

// Duration range
const MIN_DURATION = 5;
const MAX_DURATION = 60;
const TICK_STEP = 5; // Major ticks every 5 minutes

// Threshold options
const THRESHOLD_OPTIONS = [2, 5, 10];

interface FlowTimerVisualProps {
  /** Height of the timer rail */
  height?: number;
}

export function FlowTimerVisual({ height = 280 }: FlowTimerVisualProps) {
  const { colors, isDark } = useTheme();
  const timer = useFlowTimer();
  const startTimer = useFlowStore((s) => s.startTimer);
  const pauseTimer = useFlowStore((s) => s.pauseTimer);
  const resumeTimer = useFlowStore((s) => s.resumeTimer);
  const resetTimer = useFlowStore((s) => s.resetTimer);
  const setSelectedDuration = useFlowStore((s) => s.setSelectedDuration);
  const setRevealThreshold = useFlowStore((s) => s.setRevealThreshold);

  const [showThresholdPicker, setShowThresholdPicker] = useState(false);

  // Animation values
  const indicatorY = useSharedValue(0);

  // Calculate Y position from duration
  const durationToY = useCallback(
    (duration: number) => {
      const ratio = (duration - MIN_DURATION) / (MAX_DURATION - MIN_DURATION);
      return height - ratio * height;
    },
    [height]
  );

  // Calculate duration from Y position
  const yToDuration = useCallback(
    (y: number) => {
      const ratio = 1 - y / height;
      const duration = MIN_DURATION + ratio * (MAX_DURATION - MIN_DURATION);
      return Math.round(Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration)));
    },
    [height]
  );

  // Update indicator position when duration changes
  useEffect(() => {
    indicatorY.value = withSpring(durationToY(timer.selectedDurationMin), {
      damping: 20,
      stiffness: 200,
    });
  }, [timer.selectedDurationMin, durationToY, indicatorY]);

  // Handle drag gesture for duration selection
  const panGesture = Gesture.Pan()
    .enabled(timer.state === 'idle')
    .onUpdate((e) => {
      const newY = Math.max(0, Math.min(height, e.y));
      indicatorY.value = newY;
    })
    .onEnd((e) => {
      const newY = Math.max(0, Math.min(height, e.y));
      const newDuration = yToDuration(newY);
      runOnJS(setSelectedDuration)(newDuration);
    });

  // Handle tap on rail to set duration
  const tapGesture = Gesture.Tap()
    .enabled(timer.state === 'idle')
    .onEnd((e) => {
      const newDuration = yToDuration(e.y);
      runOnJS(setSelectedDuration)(newDuration);
    });

  // Handle long press to set threshold
  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd(() => {
      runOnJS(setShowThresholdPicker)(true);
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture, longPressGesture);

  // Timer controls
  const handleStart = useCallback(() => {
    startTimer();
  }, [startTimer]);

  const handlePause = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  const handleResume = useCallback(() => {
    resumeTimer();
  }, [resumeTimer]);

  const handleReset = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const handleSetThreshold = useCallback(
    (threshold: number) => {
      setRevealThreshold(threshold);
      setShowThresholdPicker(false);
    },
    [setRevealThreshold]
  );

  // Indicator animated style
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: indicatorY.value }],
  }));

  // Progress calculation for running state
  const totalSeconds = timer.selectedDurationMin * 60;
  const elapsedSeconds = totalSeconds - timer.remainingSeconds;
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;

  // Generate tick marks
  const ticks = [];
  for (let min = MIN_DURATION; min <= MAX_DURATION; min += TICK_STEP) {
    const y = durationToY(min);
    const isMajor = min % 10 === 0;
    const isThreshold = THRESHOLD_OPTIONS.includes(min);
    const isSelected = min === timer.selectedDurationMin;

    ticks.push(
      <View
        key={min}
        style={[
          styles.tickRow,
          { top: y - 8 },
        ]}
      >
        {/* Tick line */}
        <View
          style={[
            styles.tick,
            {
              width: isMajor ? 16 : 10,
              backgroundColor: isSelected
                ? '#22c55e'
                : isDark
                  ? 'rgba(255,255,255,0.3)'
                  : 'rgba(0,0,0,0.2)',
            },
          ]}
        />
        {/* Label */}
        <Animated.Text
          style={[
            styles.tickLabel,
            {
              color: isSelected
                ? '#22c55e'
                : colors.textMuted,
              fontWeight: isSelected ? '600' : '400',
            },
          ]}
        >
          {min}
        </Animated.Text>
        {/* Threshold indicator */}
        {isThreshold && min === timer.revealThresholdMin && (
          <View style={styles.thresholdDot} />
        )}
      </View>
    );
  }

  // Running progress ticks
  const progressTicks = [];
  if (timer.state === 'running' || timer.state === 'paused') {
    const remainingMin = Math.ceil(timer.remainingSeconds / 60);
    const startY = durationToY(timer.selectedDurationMin);
    const endY = durationToY(MIN_DURATION);
    const progressY = startY + (endY - startY) * progress;

    for (let min = MIN_DURATION; min <= timer.selectedDurationMin; min++) {
      const y = durationToY(min);
      const isPassed = y > progressY;

      progressTicks.push(
        <View
          key={`progress-${min}`}
          style={[
            styles.progressTick,
            {
              top: y,
              backgroundColor: isPassed
                ? '#22c55e'
                : isDark
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(0,0,0,0.1)',
            },
          ]}
        />
      );
    }
  }

  return (
    <Animated.View
      entering={SlideInLeft.duration(200)}
      exiting={SlideOutLeft.duration(150)}
      style={styles.container}
    >
      {/* Timer display */}
      <View style={styles.timerDisplay}>
        <Animated.Text
          style={[
            styles.timerValue,
            {
              color:
                timer.state === 'running'
                  ? '#22c55e'
                  : timer.state === 'paused'
                    ? '#f59e0b'
                    : colors.text,
            },
          ]}
        >
          {timer.state === 'idle'
            ? timer.selectedDurationMin
            : formatFlowTime(timer.remainingSeconds)}
        </Animated.Text>
        {timer.state === 'idle' && (
          <Animated.Text style={[styles.timerUnit, { color: colors.textMuted }]}>
            min
          </Animated.Text>
        )}
      </View>

      {/* Vertical rail */}
      <GestureHandlerRootView style={{ height }}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.rail, { height }]}>
            {/* Rail track */}
            <View
              style={[
                styles.railTrack,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
            />

            {/* Progress ticks (when running) */}
            {progressTicks}

            {/* Duration ticks */}
            {ticks}

            {/* Selection indicator */}
            {timer.state === 'idle' && (
              <Animated.View style={[styles.indicator, indicatorStyle]}>
                <View style={styles.indicatorTriangle} />
                <View
                  style={[
                    styles.indicatorLine,
                    { backgroundColor: '#22c55e' },
                  ]}
                />
              </Animated.View>
            )}

            {/* Progress indicator (when running) */}
            {(timer.state === 'running' || timer.state === 'paused') && (
              <Animated.View
                style={[
                  styles.progressIndicator,
                  {
                    top: durationToY(MIN_DURATION + (timer.selectedDurationMin - MIN_DURATION) * (1 - progress)),
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressTriangle,
                    { borderBottomColor: timer.state === 'running' ? '#22c55e' : '#f59e0b' },
                  ]}
                />
              </Animated.View>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>

      {/* Controls */}
      <View style={styles.controls}>
        {timer.state === 'idle' && (
          <Pressable
            onPress={handleStart}
            style={({ pressed, hovered }) => [
              styles.controlButton,
              styles.startButton,
              {
                backgroundColor: pressed || hovered ? '#16a34a' : '#22c55e',
              },
            ]}
          >
            <Feather name="play" size={16} color="#fff" />
          </Pressable>
        )}

        {timer.state === 'running' && (
          <Pressable
            onPress={handlePause}
            style={({ pressed, hovered }) => [
              styles.controlButton,
              {
                backgroundColor:
                  pressed || hovered
                    ? isDark
                      ? 'rgba(255,255,255,0.15)'
                      : 'rgba(0,0,0,0.1)'
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.05)',
              },
            ]}
          >
            <Feather name="pause" size={16} color={colors.text} />
          </Pressable>
        )}

        {timer.state === 'paused' && (
          <View style={styles.pausedControls}>
            <Pressable
              onPress={handleResume}
              style={({ pressed, hovered }) => [
                styles.controlButton,
                {
                  backgroundColor: pressed || hovered ? '#16a34a' : '#22c55e',
                },
              ]}
            >
              <Feather name="play" size={14} color="#fff" />
            </Pressable>
            <Pressable
              onPress={handleReset}
              style={({ pressed, hovered }) => [
                styles.controlButton,
                {
                  backgroundColor:
                    pressed || hovered
                      ? isDark
                        ? 'rgba(255,255,255,0.15)'
                        : 'rgba(0,0,0,0.1)'
                      : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              <Feather name="rotate-ccw" size={14} color={colors.text} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Threshold info */}
      <Pressable onPress={() => setShowThresholdPicker(true)}>
        <Animated.Text style={[styles.thresholdHint, { color: colors.textMuted }]}>
          reveals at {timer.revealThresholdMin}m
        </Animated.Text>
      </Pressable>

      {/* Threshold picker modal */}
      {showThresholdPicker && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.thresholdPicker,
            {
              backgroundColor: isDark ? colors.bgSurface : '#fff',
              borderColor: colors.border,
            },
          ]}
        >
          <Animated.Text style={[styles.thresholdTitle, { color: colors.text }]}>
            Auto-reveal at
          </Animated.Text>
          {THRESHOLD_OPTIONS.map((threshold) => (
            <Pressable
              key={threshold}
              onPress={() => handleSetThreshold(threshold)}
              style={({ pressed, hovered }) => [
                styles.thresholdOption,
                {
                  backgroundColor:
                    threshold === timer.revealThresholdMin
                      ? isDark
                        ? 'rgba(34,197,94,0.2)'
                        : 'rgba(34,197,94,0.1)'
                      : pressed || hovered
                        ? isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.05)'
                        : 'transparent',
                },
              ]}
            >
              <Animated.Text
                style={[
                  styles.thresholdOptionText,
                  {
                    color:
                      threshold === timer.revealThresholdMin
                        ? '#22c55e'
                        : colors.text,
                  },
                ]}
              >
                {threshold} min
              </Animated.Text>
              {threshold === timer.revealThresholdMin && (
                <Feather name="check" size={14} color="#22c55e" />
              )}
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowThresholdPicker(false)}
            style={styles.thresholdClose}
          >
            <Animated.Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Close
            </Animated.Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  timerDisplay: {
    alignItems: 'center',
  },
  timerValue: {
    fontFamily: 'SpaceMono',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -2,
  },
  timerUnit: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: -4,
  },
  rail: {
    width: 80,
    position: 'relative',
  },
  railTrack: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
  },
  tickRow: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
  },
  tick: {
    height: 2,
    borderRadius: 1,
  },
  tickLabel: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    marginLeft: spacing[1.5],
  },
  thresholdDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22d3ee',
    marginLeft: spacing[1],
  },
  progressTick: {
    position: 'absolute',
    left: 18,
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  indicator: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#22c55e',
  },
  indicatorLine: {
    width: 40,
    height: 2,
    marginLeft: 2,
  },
  progressIndicator: {
    position: 'absolute',
    left: 14,
  },
  progressTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {},
  pausedControls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  thresholdHint: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thresholdPicker: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    padding: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  thresholdTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  thresholdOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radii.sm,
  },
  thresholdOptionText: {
    fontFamily: 'SpaceMono',
    fontSize: 13,
  },
  thresholdClose: {
    alignItems: 'center',
    paddingTop: spacing[2],
    marginTop: spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
});
