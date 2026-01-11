/**
 * FlowTimerVisual - Sophisticated tick-based timer visualization
 *
 * Features:
 * - Vertical tick marks representing time
 * - Middle mouse wheel to adjust duration
 * - Click to toggle minimal mode (hides time, shows last 2-5-10 mins)
 * - Smooth scale + opacity transitions
 * - Subtle, deep aesthetic
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme, spacing, radii } from '@/design-system';
import {
  useFlowStore,
  useFlowTimer,
  useFlowPreferences,
  formatFlowTime,
} from '@mythos/state';

interface FlowTimerVisualProps {
  /** Orientation of the tick marks */
  orientation?: 'horizontal' | 'vertical';
  /** Total width/height of the visualization */
  size?: number;
}

// Duration presets in minutes
const DURATION_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60];
const MIN_DURATION = 5;
const MAX_DURATION = 60;
const TICK_COUNT = 60; // One tick per minute

export function FlowTimerVisual({
  orientation = 'horizontal',
  size = 200,
}: FlowTimerVisualProps) {
  const { colors, isDark } = useTheme();
  const timer = useFlowTimer();
  const preferences = useFlowPreferences();
  const startTimer = useFlowStore((s) => s.startTimer);
  const pauseTimer = useFlowStore((s) => s.pauseTimer);
  const resumeTimer = useFlowStore((s) => s.resumeTimer);
  const resetTimer = useFlowStore((s) => s.resetTimer);
  const updatePreferences = useFlowStore((s) => s.updatePreferences);

  const [minimalMode, setMinimalMode] = useState(false);
  const [showLastMinutes, setShowLastMinutes] = useState(5); // 2, 5, or 10
  const containerRef = useRef<View>(null);

  // Animation values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const timeOpacity = useSharedValue(1);
  const progressPosition = useSharedValue(0);

  // Calculate progress (0-1)
  const totalSeconds = preferences.workDurationMin * 60;
  const elapsedSeconds = totalSeconds - timer.remainingSeconds;
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;

  // Update progress animation
  useEffect(() => {
    progressPosition.value = withTiming(progress, { duration: 300 });
  }, [progress, progressPosition]);

  // Toggle minimal mode
  const handlePress = useCallback(() => {
    setMinimalMode((prev) => !prev);
    timeOpacity.value = withTiming(minimalMode ? 1 : 0.3, { duration: 200 });
    scale.value = withSpring(minimalMode ? 1 : 0.95, { damping: 15 });
  }, [minimalMode, timeOpacity, scale]);

  // Cycle through last minutes display (2 -> 5 -> 10 -> 2)
  const handleDoubleTap = useCallback(() => {
    setShowLastMinutes((prev) => {
      if (prev === 2) return 5;
      if (prev === 5) return 10;
      return 2;
    });
  }, []);

  // Handle wheel to adjust duration
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return; // Only with shift key for precision
      e.preventDefault();

      const delta = e.deltaY > 0 ? -5 : 5; // 5 minute increments
      const newDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, preferences.workDurationMin + delta));

      if (newDuration !== preferences.workDurationMin) {
        updatePreferences({ workDurationMin: newDuration });
        // Visual feedback
        scale.value = withSpring(1.02, { damping: 20 });
        setTimeout(() => {
          scale.value = withSpring(1, { damping: 20 });
        }, 100);
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [preferences.workDurationMin, updatePreferences, scale]);

  // Timer control on click
  const handleTimerToggle = useCallback(() => {
    if (timer.state === 'idle') {
      startTimer();
    } else if (timer.state === 'running') {
      pauseTimer();
    } else if (timer.state === 'paused') {
      resumeTimer();
    }
  }, [timer.state, startTimer, pauseTimer, resumeTimer]);

  // Container animated style
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Time display animated style
  const timeDisplayStyle = useAnimatedStyle(() => ({
    opacity: timeOpacity.value,
  }));

  // Progress indicator position
  const progressStyle = useAnimatedStyle(() => {
    const position = interpolate(
      progressPosition.value,
      [0, 1],
      [0, size - 4],
      Extrapolation.CLAMP
    );

    return orientation === 'horizontal'
      ? { left: position }
      : { top: position };
  });

  // Generate tick marks
  const ticks = [];
  const tickSpacing = size / TICK_COUNT;

  for (let i = 0; i <= TICK_COUNT; i++) {
    const isMajor = i % 10 === 0;
    const isMid = i % 5 === 0 && !isMajor;
    const isActive = i <= progress * TICK_COUNT;

    // In minimal mode, only show last N minutes of ticks
    const minutesFromEnd = TICK_COUNT - i;
    const showInMinimal = minutesFromEnd <= showLastMinutes;

    const tickHeight = isMajor ? 16 : isMid ? 10 : 6;
    const tickOpacity = minimalMode
      ? (showInMinimal ? (isActive ? 1 : 0.4) : 0.1)
      : (isActive ? 1 : 0.3);

    ticks.push(
      <View
        key={i}
        style={[
          styles.tick,
          orientation === 'horizontal'
            ? {
                left: i * tickSpacing,
                height: tickHeight,
                width: isMajor ? 2 : 1,
              }
            : {
                top: i * tickSpacing,
                width: tickHeight,
                height: isMajor ? 2 : 1,
              },
          {
            backgroundColor: isActive
              ? (timer.isBreak ? '#22d3ee' : '#22c55e')
              : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
            opacity: tickOpacity,
          },
        ]}
      />
    );
  }

  // Remaining time in minutes
  const remainingMinutes = Math.ceil(timer.remainingSeconds / 60);

  return (
    <Pressable onPress={handleTimerToggle} onLongPress={handlePress}>
      <Animated.View
        ref={containerRef}
        style={[
          styles.container,
          orientation === 'horizontal'
            ? { width: size, height: 48 }
            : { width: 48, height: size },
          containerStyle,
        ]}
      >
        {/* Time display */}
        <Animated.View style={[styles.timeDisplay, timeDisplayStyle]}>
          <Animated.Text
            style={[
              styles.timeText,
              {
                color: timer.isBreak
                  ? '#22d3ee'
                  : timer.state === 'running'
                    ? '#22c55e'
                    : colors.textMuted,
              },
            ]}
          >
            {minimalMode ? remainingMinutes : formatFlowTime(timer.remainingSeconds)}
          </Animated.Text>
        </Animated.View>

        {/* Tick container */}
        <View
          style={[
            styles.tickContainer,
            orientation === 'horizontal'
              ? { width: size, height: 20 }
              : { width: 20, height: size },
          ]}
        >
          {ticks}

          {/* Progress indicator (triangle) */}
          <Animated.View
            style={[
              styles.progressIndicator,
              orientation === 'horizontal'
                ? styles.progressIndicatorHorizontal
                : styles.progressIndicatorVertical,
              progressStyle,
              {
                borderBottomColor: timer.isBreak ? '#22d3ee' : '#22c55e',
              },
            ]}
          />
        </View>

        {/* Duration labels */}
        {!minimalMode && (
          <View
            style={[
              styles.labelsContainer,
              orientation === 'horizontal'
                ? { width: size, flexDirection: 'row' }
                : { height: size, flexDirection: 'column' },
            ]}
          >
            <Animated.Text style={[styles.labelText, { color: colors.textMuted }]}>
              0
            </Animated.Text>
            <Animated.Text style={[styles.labelText, { color: colors.textMuted }]}>
              {Math.round(preferences.workDurationMin / 2)}
            </Animated.Text>
            <Animated.Text style={[styles.labelText, { color: colors.textMuted }]}>
              {preferences.workDurationMin}
            </Animated.Text>
          </View>
        )}

        {/* Minimal mode hint */}
        {minimalMode && (
          <Animated.Text
            style={[
              styles.hintText,
              { color: colors.textMuted },
            ]}
          >
            {showLastMinutes}m
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  timeDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: 'SpaceMono',
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -1,
  },
  tickContainer: {
    position: 'relative',
  },
  tick: {
    position: 'absolute',
    borderRadius: 1,
  },
  progressIndicator: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  progressIndicatorHorizontal: {
    top: -8,
    marginLeft: -4,
  },
  progressIndicatorVertical: {
    left: -8,
    marginTop: -4,
    transform: [{ rotate: '-90deg' }],
  },
  labelsContainer: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
  },
  labelText: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    opacity: 0.6,
  },
  hintText: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    opacity: 0.5,
  },
});
