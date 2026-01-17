/**
 * InboxTabs - Tab bar for inbox filtering (Expo/RN)
 *
 * Tabs: All | Pulse | Changes | Activity | Artifacts
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';
import type { InboxTab } from '@mythos/state';

interface TabConfig {
  id: InboxTab;
  label: string;
  shortLabel?: string;
}

const tabs: TabConfig[] = [
  { id: 'all', label: 'All' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'changes', label: 'Changes' },
  { id: 'activity', label: 'Activity' },
  { id: 'artifacts', label: 'Artifacts' },
];

interface InboxTabsProps {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  counts?: {
    pulse?: number;
    changes?: number;
    activity?: number;
    artifacts?: number;
    total?: number;
  };
  compact?: boolean;
}

export function InboxTabs({
  activeTab,
  onTabChange,
  counts = {},
  compact = false,
}: InboxTabsProps) {
  const { colors, isDark } = useTheme();

  const getCount = (tabId: InboxTab): number | undefined => {
    switch (tabId) {
      case 'all':
        return counts.total;
      case 'pulse':
        return counts.pulse;
      case 'changes':
        return counts.changes;
      case 'activity':
        return counts.activity;
      case 'artifacts':
        return counts.artifacts;
      default:
        return undefined;
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {tabs.map((tab) => {
        const count = getCount(tab.id);
        const isActive = activeTab === tab.id;
        const showCount = count !== undefined && count > 0;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            style={[
              styles.tab,
              {
                backgroundColor: isActive
                  ? isDark ? palette.gray[700] : palette.gray[200]
                  : 'transparent',
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.tabLabel,
                compact && styles.tabLabelCompact,
                { color: isActive ? colors.text : colors.textSecondary },
              ]}
            >
              {compact && tab.shortLabel ? tab.shortLabel : tab.label}
            </Text>
            {showCount && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isActive
                      ? colors.accent
                      : isDark ? palette.gray[800] : palette.gray[100],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isActive ? '#fff' : colors.textMuted },
                  ]}
                >
                  {count > 99 ? '99+' : count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[1],
  },
  containerCompact: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1] + 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1] + 2,
    borderRadius: radii.md,
    gap: spacing[1] + 2,
  },
  tabLabel: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  tabLabelCompact: {
    fontSize: typography.xs,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
