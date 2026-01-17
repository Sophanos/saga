/**
 * Inbox - Unified inbox panel (Expo/RN)
 *
 * Shows all attention-worthy items:
 * - Pulse: Ambient signals
 * - Changes: Knowledge PRs
 * - Activity: Widget executions
 * - Artifacts: Stale outputs
 */

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';
import {
  useInboxStore,
  useInboxTab,
  useGroupedInboxItems,
  usePulseItems,
  useChangeItems,
  useActivityInboxItems,
  useArtifactInboxItems,
  type InboxTab,
} from '@mythos/state';
import { InboxTabs } from './InboxTabs';
import { InboxSection } from './InboxSection';
import { InboxEmptyState, InboxLoadingState } from './InboxEmptyState';
import {
  PulseItem,
  ChangeItemRow,
  ActivityItemRow,
  ArtifactItemRow,
} from './InboxItem';

interface InboxProps {
  isLoading?: boolean;
  onClose?: () => void;
  onNavigateToDocument?: (documentId: string) => void;
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToArtifact?: (artifactId: string) => void;
}

export function Inbox({
  isLoading = false,
  onClose,
  onNavigateToDocument,
  onNavigateToEntity,
  onNavigateToArtifact,
}: InboxProps) {
  const { colors, isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTab = useInboxTab();
  const setTab = useInboxStore((s) => s.setTab);
  const markAllRead = useInboxStore((s) => s.markAllRead);
  const clearDismissed = useInboxStore((s) => s.clearDismissed);

  // Get items
  const pulseItems = usePulseItems();
  const changeItems = useChangeItems();
  const activityItems = useActivityInboxItems();
  const artifactItems = useArtifactInboxItems();
  const grouped = useGroupedInboxItems();

  // Calculate counts
  const counts = useMemo(
    () => ({
      pulse: pulseItems.filter((i) => !i.read).length,
      changes: changeItems.filter((i) => i.status === 'proposed').length,
      activity: activityItems.filter(
        (i) => i.status === 'ready' || i.status === 'failed'
      ).length,
      artifacts: artifactItems.filter((i) => i.status === 'stale').length,
    }),
    [pulseItems, changeItems, activityItems, artifactItems]
  );

  // Filter items based on active tab
  const filteredPulse = activeTab === 'all' || activeTab === 'pulse' ? grouped.pulse : [];
  const filteredChanges = activeTab === 'all' || activeTab === 'changes' ? grouped.change : [];
  const filteredActivity = activeTab === 'all' || activeTab === 'activity' ? grouped.activity : [];
  const filteredArtifacts = activeTab === 'all' || activeTab === 'artifacts' ? grouped.artifact : [];

  // Categorize activity items
  const runningActivity = filteredActivity.filter((i) => i.status === 'running');
  const needsAttentionActivity = filteredActivity.filter(
    (i) => i.status === 'ready' || i.status === 'failed'
  );
  const completedActivity = filteredActivity.filter((i) => i.status === 'applied');

  // Check if current tab is empty
  const isEmpty =
    filteredPulse.length === 0 &&
    filteredChanges.length === 0 &&
    filteredActivity.length === 0 &&
    filteredArtifacts.length === 0;

  const bgColor = isDark ? palette.gray[800] : '#fff';
  const borderColor = isDark ? palette.gray[700] : palette.gray[200];

  return (
    <Animated.View
      entering={ZoomIn.duration(150)}
      style={[
        styles.container,
        { backgroundColor: bgColor, borderColor },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? palette.gray[700] : palette.gray[150] }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Inbox</Text>

        <View style={styles.headerActions}>
          {/* Menu button */}
          <View style={styles.menuContainer}>
            <Pressable
              onPress={() => setMenuOpen(!menuOpen)}
              style={({ pressed }) => [
                styles.menuButton,
                { backgroundColor: pressed || menuOpen ? (isDark ? palette.gray[700] : palette.gray[150]) : 'transparent' },
              ]}
            >
              <Feather name="more-horizontal" size={16} color={colors.textMuted} />
            </Pressable>

            {/* Dropdown menu */}
            {menuOpen && (
              <Animated.View
                entering={FadeIn.duration(100)}
                style={[
                  styles.menuDropdown,
                  { backgroundColor: isDark ? palette.gray[750] : '#fff', borderColor },
                ]}
              >
                <Pressable
                  onPress={() => { markAllRead(); setMenuOpen(false); }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: pressed ? (isDark ? palette.gray[700] : palette.gray[100]) : 'transparent' },
                  ]}
                >
                  <Feather name="check" size={14} color={colors.textSecondary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Mark all as read</Text>
                </Pressable>
                <Pressable
                  onPress={() => { clearDismissed(); setMenuOpen(false); }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: pressed ? (isDark ? palette.gray[700] : palette.gray[100]) : 'transparent' },
                  ]}
                >
                  <Feather name="trash-2" size={14} color={colors.textSecondary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Clear dismissed</Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* Close button */}
          {onClose && (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: pressed ? (isDark ? palette.gray[700] : palette.gray[150]) : 'transparent' },
              ]}
            >
              <Feather name="x" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: isDark ? palette.gray[700] : palette.gray[150] }]}>
        <InboxTabs
          activeTab={activeTab}
          onTabChange={setTab}
          counts={counts}
        />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => menuOpen && setMenuOpen(false)}>
          {isLoading ? (
            <InboxLoadingState />
          ) : isEmpty ? (
            <InboxEmptyState tab={activeTab} />
          ) : (
            <>
              {/* Pulse Section */}
              {filteredPulse.length > 0 && (
                <InboxSection
                  title="Pulse"
                  count={filteredPulse.filter((i) => !i.read).length}
                >
                  {filteredPulse.map((item) => (
                    <PulseItem
                      key={item.id}
                      title={item.title}
                      description={item.subtitle}
                      context={item.context}
                      signalType={item.signalType}
                      isUnread={!item.read}
                      updatedAt={item.updatedAt}
                      onReview={() => {
                        if (item.targetType === 'document' && item.targetId) {
                          onNavigateToDocument?.(item.targetId);
                        } else if (item.targetType === 'entity' && item.targetId) {
                          onNavigateToEntity?.(item.targetId);
                        }
                      }}
                      onDismiss={() => {
                        useInboxStore.getState().dismissItem('pulse', item.id);
                      }}
                    />
                  ))}
                </InboxSection>
              )}

              {/* Changes Section */}
              {filteredChanges.length > 0 && (
                <InboxSection title="Changes" count={filteredChanges.length}>
                  {filteredChanges.map((item) => (
                    <ChangeItemRow
                      key={item.id}
                      title={item.title}
                      operation={item.operation}
                      riskLevel={item.riskLevel}
                      actorName={item.metadata?.actorName as string | undefined}
                      updatedAt={item.updatedAt}
                      onApprove={() => {}}
                      onReject={() => {}}
                    />
                  ))}
                </InboxSection>
              )}

              {/* Activity - Running */}
              {runningActivity.length > 0 && (
                <InboxSection title="Running" count={runningActivity.length}>
                  {runningActivity.map((item) => (
                    <ActivityItemRow
                      key={item.id}
                      title={item.title}
                      statusText={item.statusText}
                      documentName={item.documentName}
                      status="running"
                      isUnread={!item.read}
                      updatedAt={item.updatedAt}
                    />
                  ))}
                </InboxSection>
              )}

              {/* Activity - Needs Attention */}
              {needsAttentionActivity.length > 0 && (
                <InboxSection title="Needs attention" count={needsAttentionActivity.length}>
                  {needsAttentionActivity.map((item) => (
                    <ActivityItemRow
                      key={item.id}
                      title={item.title}
                      statusText={item.statusText}
                      documentName={item.documentName}
                      status={item.status as 'ready' | 'failed'}
                      isUnread={!item.read}
                      updatedAt={item.updatedAt}
                      onView={() => {
                        if (item.documentId) {
                          onNavigateToDocument?.(item.documentId);
                        }
                      }}
                      onRetry={() => {}}
                    />
                  ))}
                </InboxSection>
              )}

              {/* Activity - Completed */}
              {completedActivity.length > 0 && (
                <InboxSection title="Completed" count={completedActivity.length} defaultExpanded={false}>
                  {completedActivity.slice(0, 5).map((item) => (
                    <ActivityItemRow
                      key={item.id}
                      title={item.title}
                      statusText={item.statusText}
                      documentName={item.documentName}
                      status="applied"
                      isUnread={false}
                      updatedAt={item.updatedAt}
                      onView={() => {
                        if (item.documentId) {
                          onNavigateToDocument?.(item.documentId);
                        }
                      }}
                    />
                  ))}
                  {completedActivity.length > 5 && (
                    <Pressable style={styles.showMore}>
                      <Text style={[styles.showMoreText, { color: colors.textMuted }]}>
                        Show {completedActivity.length - 5} more
                      </Text>
                    </Pressable>
                  )}
                </InboxSection>
              )}

              {/* Artifacts Section */}
              {filteredArtifacts.length > 0 && (
                <InboxSection
                  title="Artifacts"
                  count={filteredArtifacts.filter((i) => i.status === 'stale').length}
                >
                  {filteredArtifacts
                    .filter((i) => i.status === 'stale')
                    .map((item) => (
                      <ArtifactItemRow
                        key={item.id}
                        title={item.title}
                        artifactType={item.subtitle ?? ''}
                        isStale={true}
                        lastSyncedAt={item.lastSyncedAt}
                        onRefresh={() => {}}
                        onOpen={() => {
                          onNavigateToArtifact?.(item.artifactId);
                        }}
                      />
                    ))}
                </InboxSection>
              )}
            </>
          )}
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 360,
    maxHeight: 480,
    borderRadius: radii.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
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
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
  },
  showMore: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: typography.xs,
  },
});
