/**
 * ActivityInbox - Notification dropdown for widget activity
 *
 * Displays widget execution activity with tabs and grouped sections.
 */

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useMemo, useState } from 'react';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';
import {
  useActivityStore,
  useActivityTab,
  useActivityItems,
  useProjectStore,
  type ActivityItem,
  type ActivityTab,
} from '@mythos/state';
import { useEffect } from 'react';

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabButton,
        {
          backgroundColor: active
            ? isDark ? palette.gray[700] : palette.gray[200]
            : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.tabLabel,
          {
            color: active ? colors.text : colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          style={[
            styles.tabBadge,
            {
              backgroundColor: active ? colors.accent : isDark ? palette.gray[800] : palette.gray[100],
            },
          ]}
        >
          <Text
            style={[
              styles.tabBadgeText,
              { color: active ? '#fff' : colors.textMuted },
            ]}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Spinner() {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={[
          styles.spinner,
          { borderColor: colors.accent, borderTopColor: 'transparent' },
        ]}
      />
    </Animated.View>
  );
}

interface ActivityItemRowProps {
  item: ActivityItem;
  onNavigate?: (documentId: string) => void;
}

function ActivityItemRow({ item, onNavigate }: ActivityItemRowProps) {
  const { colors, isDark } = useTheme();
  const markRead = useActivityStore((s) => s.markRead);

  const handlePress = () => {
    markRead(item.id);
    // Navigate to document if available
    if (item.documentId && onNavigate) {
      onNavigate(item.documentId);
    }
  };

  const statusIcon = useMemo(() => {
    switch (item.status) {
      case 'running':
        return <Spinner />;
      case 'ready':
        return <Feather name="eye" size={14} color={colors.accent} />;
      case 'failed':
        return <Feather name="alert-circle" size={14} color={palette.red[400]} />;
      case 'applied':
        return <Feather name="check" size={14} color={palette.green[400]} />;
      default:
        return <Feather name="bell" size={14} color={colors.textMuted} />;
    }
  }, [item.status, colors]);

  const timeAgo = useMemo(() => {
    const diff = Date.now() - item.updatedAt;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, [item.updatedAt]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.itemRow,
        {
          backgroundColor: pressed
            ? isDark ? palette.gray[750] : palette.gray[150]
            : 'transparent',
        },
      ]}
    >
      <View style={styles.itemIcon}>{statusIcon}</View>

      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text
            style={[
              styles.itemLabel,
              { color: item.read ? colors.textSecondary : colors.text },
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {!item.read && (
            <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
          )}
        </View>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemStatus, { color: colors.textMuted }]} numberOfLines={1}>
            {item.statusText}
          </Text>
          {item.documentName && (
            <>
              <Text style={[styles.itemDot, { color: colors.textGhost }]}> · </Text>
              <Text style={[styles.itemDoc, { color: colors.textMuted }]} numberOfLines={1}>
                {item.documentName}
              </Text>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.itemTime, { color: colors.textGhost }]}>{timeAgo}</Text>
    </Pressable>
  );
}

function EmptyState({ tab }: { tab: ActivityTab }) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyPlaceholder}>
        {[32, 24, 28].map((width, i) => (
          <View key={i} style={styles.placeholderRow}>
            <View
              style={[
                styles.placeholderDot,
                { backgroundColor: isDark ? palette.gray[600] : palette.gray[300] },
              ]}
            />
            <View
              style={[
                styles.placeholderLine,
                { width, backgroundColor: isDark ? palette.gray[600] : palette.gray[300] },
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {tab === 'widgets' ? 'No widget activity' : 'No reminders'}
      </Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {tab === 'widgets'
          ? 'Widget executions will appear here as they run'
          : 'Reminders will appear here when scheduled'}
      </Text>
    </View>
  );
}

export function ActivityInbox() {
  const { colors, isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTab = useActivityTab();
  const setTab = useActivityStore((s) => s.setTab);
  const close = useActivityStore((s) => s.close);
  const markAllRead = useActivityStore((s) => s.markAllRead);
  const clearCompleted = useActivityStore((s) => s.clearCompleted);
  const setCurrentDocumentId = useProjectStore((s) => s.setCurrentDocumentId);

  // Handle navigation to document and close inbox
  const handleNavigate = (documentId: string) => {
    setCurrentDocumentId(documentId);
    close();
  };

  const items = useActivityItems();
  const runningItems = useMemo(() => items.filter(i => i.status === 'running'), [items]);
  const readyItems = useMemo(() => items.filter(i => i.status === 'ready' || i.status === 'failed'), [items]);
  const completedItems = useMemo(() => items.filter(i => i.status === 'applied' || i.status === 'cancelled'), [items]);

  const hasItems = items.length > 0;
  const hasCompleted = completedItems.length > 0;

  return (
    <Pressable
      onPress={() => menuOpen && setMenuOpen(false)}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? palette.gray[800] : '#fff',
          borderColor: isDark ? palette.gray[700] : palette.gray[200],
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: isDark ? palette.gray[700] : palette.gray[150] }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={styles.menuContainer}>
          <Pressable
            onPress={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            style={({ pressed }) => [
              styles.menuButton,
              { backgroundColor: pressed || menuOpen ? (isDark ? palette.gray[700] : palette.gray[150]) : 'transparent' },
            ]}
          >
            <Feather name="more-horizontal" size={16} color={colors.textMuted} />
          </Pressable>
          {menuOpen && (
            <View style={[styles.menuDropdown, { backgroundColor: isDark ? palette.gray[750] : '#fff', borderColor: isDark ? palette.gray[600] : palette.gray[200] }]}>
              <Pressable
                onPress={() => { markAllRead(); setMenuOpen(false); }}
                style={({ pressed }) => [styles.menuItem, { backgroundColor: pressed ? (isDark ? palette.gray[700] : palette.gray[100]) : 'transparent' }]}
              >
                <Feather name="check" size={14} color={colors.textSecondary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Mark all as read</Text>
              </Pressable>
              <Pressable
                onPress={() => { clearCompleted(); setMenuOpen(false); }}
                style={({ pressed }) => [styles.menuItem, { backgroundColor: pressed ? (isDark ? palette.gray[700] : palette.gray[100]) : 'transparent' }]}
              >
                <Feather name="trash-2" size={14} color={colors.textSecondary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Clear completed</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.tabs, { borderBottomColor: isDark ? palette.gray[700] : palette.gray[150] }]}>
        <TabButton
          label="Activity"
          count={items.length}
          active={activeTab === 'widgets'}
          onPress={() => setTab('widgets')}
        />
        <TabButton
          label="Reminders"
          active={activeTab === 'reminders'}
          onPress={() => setTab('reminders')}
        />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'widgets' && (
          <>
            {!hasItems && <EmptyState tab="widgets" />}

            {runningItems.length > 0 && (
              <Section title="Running">
                {runningItems.map((item) => (
                  <ActivityItemRow key={item.id} item={item} onNavigate={handleNavigate} />
                ))}
              </Section>
            )}

            {readyItems.length > 0 && (
              <Section title="Needs attention">
                {readyItems.map((item) => (
                  <ActivityItemRow key={item.id} item={item} onNavigate={handleNavigate} />
                ))}
              </Section>
            )}

            {completedItems.length > 0 && (
              <Section title="Completed">
                {completedItems.slice(0, 5).map((item) => (
                  <ActivityItemRow key={item.id} item={item} onNavigate={handleNavigate} />
                ))}
                {completedItems.length > 5 && (
                  <Pressable style={styles.showMore}>
                    <Text style={[styles.showMoreText, { color: colors.textMuted }]}>
                      Show {completedItems.length - 5} more
                    </Text>
                  </Pressable>
                )}
              </Section>
            )}
          </>
        )}

        {activeTab === 'reminders' && <EmptyState tab="reminders" />}
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 320,
    maxHeight: 440,
    borderRadius: radii.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    zIndex: 100,
  },
  headerTitle: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  menuContainer: {
    position: 'relative',
  },
  menuButton: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    minWidth: 180,
    borderRadius: radii.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 100,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
  },
  menuItemText: {
    fontSize: typography.sm,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[1],
    borderBottomWidth: 1,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radii.md,
    gap: spacing[1] + 2,
  },
  tabLabel: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingVertical: spacing[2],
  },
  sectionHeader: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1] + 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
    gap: spacing[3],
  },
  itemIcon: {
    marginTop: 2,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemLabel: {
    fontSize: typography.sm,
    fontWeight: '500',
    flexShrink: 1,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  itemStatus: {
    fontSize: typography.xs,
    flexShrink: 1,
  },
  itemDot: {
    fontSize: typography.xs,
  },
  itemDoc: {
    fontSize: typography.xs,
    flexShrink: 1,
  },
  itemTime: {
    fontSize: 10,
    flexShrink: 0,
  },
  showMore: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: typography.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[6],
  },
  emptyPlaceholder: {
    marginBottom: spacing[6],
    opacity: 0.3,
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
  emptyTitle: {
    fontSize: typography.sm,
    fontWeight: '500',
    marginBottom: spacing[1],
  },
  emptyText: {
    fontSize: typography.xs,
    textAlign: 'center',
    maxWidth: 200,
  },
});
