/**
 * ChatSelector - Dropdown for chat history
 * Shows threads grouped by date (Today, Last 7 days, etc.)
 */

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import { useTheme, spacing, radii, typography, shadows } from '@/design-system';
import { useAIStore, type ChatThread } from '@mythos/state';

interface ChatSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export function ChatSelector({ visible, onClose }: ChatSelectorProps) {
  const { colors } = useTheme();
  const { threads, currentThreadId, selectThread, createThread, deleteThread } = useAIStore();

  if (!visible) return null;

  // Group threads by date
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const groups = {
    today: threads.filter(t => now - t.updatedAt < dayMs),
    week: threads.filter(t => now - t.updatedAt >= dayMs && now - t.updatedAt < 7 * dayMs),
    month: threads.filter(t => now - t.updatedAt >= 7 * dayMs && now - t.updatedAt < 30 * dayMs),
    older: threads.filter(t => now - t.updatedAt >= 30 * dayMs),
  };

  const handleSelect = (id: string) => {
    selectThread(id);
    onClose();
  };

  const handleNewChat = () => {
    createThread();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Dropdown */}
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={[
          styles.container,
          shadows.lg,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
          },
        ]}
      >
        {/* New chat button */}
        <Pressable
          style={({ pressed }) => [
            styles.newChatBtn,
            { backgroundColor: pressed ? colors.bgHover : 'transparent' },
          ]}
          onPress={handleNewChat}
        >
          <Text style={[styles.newChatIcon, { color: colors.accent }]}>+</Text>
          <Text style={[styles.newChatText, { color: colors.text }]}>New Chat</Text>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Thread list */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {groups.today.length > 0 && (
            <ThreadGroup
              title="Today"
              threads={groups.today}
              currentId={currentThreadId}
              onSelect={handleSelect}
              onDelete={deleteThread}
            />
          )}
          {groups.week.length > 0 && (
            <ThreadGroup
              title="Last 7 days"
              threads={groups.week}
              currentId={currentThreadId}
              onSelect={handleSelect}
              onDelete={deleteThread}
            />
          )}
          {groups.month.length > 0 && (
            <ThreadGroup
              title="Last 30 days"
              threads={groups.month}
              currentId={currentThreadId}
              onSelect={handleSelect}
              onDelete={deleteThread}
            />
          )}
          {groups.older.length > 0 && (
            <ThreadGroup
              title="Older"
              threads={groups.older}
              currentId={currentThreadId}
              onSelect={handleSelect}
              onDelete={deleteThread}
            />
          )}

          {threads.length === 0 && (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No conversations yet
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

interface ThreadGroupProps {
  title: string;
  threads: ChatThread[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function ThreadGroup({ title, threads, currentId, onSelect, onDelete }: ThreadGroupProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.textMuted }]}>{title}</Text>
      {threads.map((thread) => (
        <Pressable
          key={thread.id}
          style={({ pressed }) => [
            styles.threadItem,
            {
              backgroundColor: thread.id === currentId
                ? colors.bgActive
                : pressed
                ? colors.bgHover
                : 'transparent',
            },
          ]}
          onPress={() => onSelect(thread.id)}
        >
          <Text
            style={[styles.threadName, { color: colors.text }]}
            numberOfLines={1}
          >
            {thread.name}
          </Text>
          <Pressable
            onPress={() => onDelete(thread.id)}
            style={styles.deleteBtn}
            hitSlop={8}
          >
            <Text style={{ color: colors.textMuted, fontSize: typography.xs }}>×</Text>
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  container: {
    position: 'absolute',
    top: spacing[12],
    left: spacing[4],
    right: spacing[4],
    maxHeight: 320,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 100,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    gap: spacing[2],
  },
  newChatIcon: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
  },
  newChatText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  divider: {
    height: 1,
  },
  list: {
    maxHeight: 260,
  },
  group: {
    paddingVertical: spacing[2],
  },
  groupTitle: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  threadName: {
    flex: 1,
    fontSize: typography.sm,
  },
  deleteBtn: {
    padding: spacing[1],
  },
  empty: {
    padding: spacing[6],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
  },
});
