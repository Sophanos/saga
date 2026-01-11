/**
 * FlowSummaryModal - Session summary shown on exit (Expo)
 *
 * Celebrates the writer's accomplishment with session statistics.
 */

import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography, shadows } from '@/design-system';
import { type SessionStats, formatFlowDuration } from '@mythos/state';

interface FlowSummaryModalProps {
  stats: SessionStats;
  onClose: () => void;
}

export function FlowSummaryModal({ stats, onClose }: FlowSummaryModalProps) {
  const { colors, isDark } = useTheme();

  // Determine encouragement message based on performance
  const getMessage = () => {
    if (stats.wordsWritten >= 1000) {
      return { emoji: '\ud83d\udd25', text: 'Incredible session!' };
    }
    if (stats.wordsWritten >= 500) {
      return { emoji: '\u2728', text: 'Great progress!' };
    }
    if (stats.wordsWritten >= 100) {
      return { emoji: '\ud83d\udc4f', text: 'Nice work!' };
    }
    return { emoji: '\ud83c\udf31', text: 'Every word counts.' };
  };

  const message = getMessage();
  const wordsPerMinute = stats.durationSeconds >= 60
    ? Math.round(stats.wordsWritten / (stats.durationSeconds / 60))
    : null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.duration(300).springify().damping(18)}
          style={[
            styles.modal,
            shadows.lg,
            {
              backgroundColor: colors.bgElevated,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={({ pressed, hovered }) => [
              styles.closeButton,
              {
                backgroundColor: hovered || pressed
                  ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                  : 'transparent',
              },
            ]}
          >
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>{message.emoji}</Text>
            <Text style={[styles.title, { color: colors.text }]}>{message.text}</Text>
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            {/* Words written */}
            <View style={[styles.statCard, { backgroundColor: colors.bgHover }]}>
              <Feather name="file-text" size={18} color="#22d3ee" />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.wordsWritten.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>words</Text>
            </View>

            {/* Duration */}
            <View style={[styles.statCard, { backgroundColor: colors.bgHover }]}>
              <Feather name="clock" size={18} color="#22c55e" />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatFlowDuration(stats.durationSeconds)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>focused</Text>
            </View>
          </View>

          {/* Pomodoros */}
          {stats.completedPomodoros > 0 && (
            <View style={[styles.pomodoroRow, { backgroundColor: colors.bgHover }]}>
              <Feather name="target" size={14} color="#f59e0b" />
              <Text style={[styles.pomodoroText, { color: colors.textSecondary }]}>
                <Text style={{ color: colors.text, fontWeight: typography.semibold }}>
                  {stats.completedPomodoros}
                </Text>
                {' '}
                {stats.completedPomodoros === 1 ? 'pomodoro' : 'pomodoros'} completed
              </Text>
            </View>
          )}

          {/* WPM */}
          {wordsPerMinute !== null && (
            <View style={styles.wpmRow}>
              <Feather name="zap" size={14} color={colors.textMuted} />
              <Text style={[styles.wpmText, { color: colors.textMuted }]}>
                ~{wordsPerMinute} words/minute
              </Text>
            </View>
          )}

          {/* Continue button */}
          <Pressable
            onPress={onClose}
            style={({ pressed, hovered }) => [
              styles.continueButton,
              {
                backgroundColor: hovered || pressed
                  ? colors.accentHover
                  : colors.accent,
              },
            ]}
          >
            <Text style={styles.continueText}>Continue Writing</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing[5],
  },
  closeButton: {
    position: 'absolute',
    top: spacing[3],
    right: spacing[3],
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  emoji: {
    fontSize: 40,
    marginBottom: spacing[2],
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radii.lg,
    gap: spacing[1],
  },
  statValue: {
    fontFamily: 'SpaceMono',
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
  },
  statLabel: {
    fontSize: typography.xs,
  },
  pomodoroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    marginBottom: spacing[3],
  },
  pomodoroText: {
    fontSize: typography.sm,
  },
  wpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[4],
  },
  wpmText: {
    fontSize: typography.sm,
  },
  continueButton: {
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    alignItems: 'center',
  },
  continueText: {
    color: '#ffffff',
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
});
