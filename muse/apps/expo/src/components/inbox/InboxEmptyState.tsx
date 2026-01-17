/**
 * InboxEmptyState - Empty states for inbox tabs (Expo/RN)
 */

import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography } from '@/design-system';
import { palette } from '@/design-system/colors';
import type { InboxTab } from '@mythos/state';

interface EmptyStateConfig {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}

const emptyStates: Record<InboxTab, EmptyStateConfig> = {
  all: {
    icon: 'inbox',
    title: 'All caught up',
    description: 'Nothing needs your attention right now',
  },
  pulse: {
    icon: 'zap',
    title: 'No signals',
    description: 'Ambient intelligence signals will appear here',
  },
  changes: {
    icon: 'git-pull-request',
    title: 'No pending changes',
    description: 'Knowledge changes requiring approval will appear here',
  },
  activity: {
    icon: 'activity',
    title: 'No recent activity',
    description: 'Widget executions and results will appear here',
  },
  artifacts: {
    icon: 'package',
    title: 'No stale artifacts',
    description: 'Artifacts needing refresh will appear here',
  },
};

interface InboxEmptyStateProps {
  tab: InboxTab;
}

export function InboxEmptyState({ tab }: InboxEmptyStateProps) {
  const { colors, isDark } = useTheme();
  const config = emptyStates[tab];
  const placeholderColor = isDark ? palette.gray[600] : palette.gray[300];

  return (
    <View style={styles.container}>
      {/* Placeholder skeleton */}
      <View style={styles.placeholder}>
        {[32, 24, 28].map((width, i) => (
          <View key={i} style={styles.placeholderRow}>
            <View style={[styles.placeholderDot, { backgroundColor: placeholderColor }]} />
            <View style={[styles.placeholderLine, { width, backgroundColor: placeholderColor }]} />
          </View>
        ))}
      </View>

      {/* Icon */}
      <View style={styles.iconContainer}>
        <Feather name={config.icon} size={32} color={colors.textGhost} style={{ opacity: 0.5 }} />
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]}>{config.title}</Text>

      {/* Description */}
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {config.description}
      </Text>
    </View>
  );
}

/**
 * Minimal empty state
 */
interface InboxEmptyStateMinimalProps {
  message: string;
}

export function InboxEmptyStateMinimal({ message }: InboxEmptyStateMinimalProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.minimalContainer}>
      <Text style={[styles.minimalText, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

/**
 * Loading state
 */
export function InboxLoadingState() {
  const { isDark } = useTheme();
  const bgColor = isDark ? palette.gray[700] : palette.gray[200];

  return (
    <View style={styles.loadingContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.loadingRow}>
          <View style={[styles.loadingDot, { backgroundColor: bgColor }]} />
          <View style={styles.loadingContent}>
            <View style={[styles.loadingLine1, { backgroundColor: bgColor }]} />
            <View style={[styles.loadingLine2, { backgroundColor: bgColor }]} />
          </View>
          <View style={[styles.loadingTime, { backgroundColor: bgColor }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[6],
  },
  placeholder: {
    marginBottom: spacing[6],
    opacity: 0.2,
    gap: spacing[2],
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  placeholderDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  placeholderLine: {
    height: 10,
    borderRadius: 5,
  },
  iconContainer: {
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.sm,
    fontWeight: '500',
    marginBottom: spacing[1],
  },
  description: {
    fontSize: typography.xs,
    textAlign: 'center',
    maxWidth: 220,
  },
  minimalContainer: {
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
  },
  minimalText: {
    fontSize: typography.xs,
  },
  loadingContainer: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[2] + 2,
    gap: spacing[3],
  },
  loadingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  loadingContent: {
    flex: 1,
    gap: spacing[2],
  },
  loadingLine1: {
    height: 14,
    width: '75%',
    borderRadius: 4,
  },
  loadingLine2: {
    height: 10,
    width: '50%',
    borderRadius: 4,
  },
  loadingTime: {
    height: 10,
    width: 32,
    borderRadius: 4,
  },
});
