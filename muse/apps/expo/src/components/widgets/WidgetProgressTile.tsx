/**
 * WidgetProgressTile - Shows widget execution progress
 * Fixed position at bottom of screen during widget execution
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';
import { useWidgetStatus, useWidgetLabel, useWidgetExecutionStore } from '@mythos/state';
import { useEffect } from 'react';

const STAGE_LABELS: Record<string, string> = {
  gathering: 'Gathering context',
  generating: 'Generating',
  formatting: 'Formatting',
  clarifying: 'Clarifying',
};

export function WidgetProgressTile() {
  const { colors, isDark } = useTheme();
  const status = useWidgetStatus();
  const widgetLabel = useWidgetLabel();
  const cancel = useWidgetExecutionStore((s) => s.cancel);

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (status !== 'idle' && status !== 'preview' && status !== 'done' && status !== 'error') {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = 0;
    }
  }, [status, rotation]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Don't show for idle, preview, done, or error states
  if (status === 'idle' || status === 'preview' || status === 'done' || status === 'error') {
    return null;
  }

  const stageLabel = STAGE_LABELS[status] || 'Working';

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? palette.gray[900] : palette.gray[50],
          borderColor: isDark ? palette.gray[700] : palette.gray[200],
        },
      ]}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.spinner, spinnerStyle]}>
          <View
            style={[
              styles.spinnerInner,
              { borderColor: colors.accent, borderTopColor: 'transparent' },
            ]}
          />
        </Animated.View>

        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: colors.text }]}>{widgetLabel}</Text>
          <Text style={[styles.stage, { color: colors.textMuted }]}>{stageLabel}</Text>
        </View>

        <Pressable
          onPress={cancel}
          style={({ pressed }) => [
            styles.cancelButton,
            {
              backgroundColor: pressed
                ? isDark
                  ? palette.gray[700]
                  : palette.gray[200]
                : 'transparent',
            },
          ]}
        >
          <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[6],
    left: spacing[6],
    borderRadius: radii.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    gap: spacing[3],
  },
  spinner: {
    width: 20,
    height: 20,
  },
  spinnerInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  stage: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  cancelButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
  },
  cancelText: {
    fontSize: typography.sm,
  },
});
