/**
 * Home Screen - Main editor view
 *
 * Shows:
 * - Document editor (future)
 * - Empty state with quick actions
 */

import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme, spacing, typography, radii } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toggleAIPanel, aiPanelMode } = useLayoutStore();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Text style={[styles.title, { color: colors.text }]}>Welcome to Mythos</Text>
        <Pressable
          onPress={toggleAIPanel}
          style={[styles.aiButton, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.aiButtonText}>
            {aiPanelMode === 'hidden' ? '🤖 Open AI' : '🤖 Close AI'}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.emptyState, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
          <Text style={[styles.emptyIcon]}>📖</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Start Writing</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Create a new chapter or select one from the sidebar
          </Text>

          <View style={styles.quickActions}>
            <QuickActionButton icon="📄" label="New Chapter" onPress={() => router.push('/editor')} />
            <QuickActionButton icon="🎭" label="New Character" onPress={() => {}} />
            <QuickActionButton icon="🗺" label="New Location" onPress={() => {}} />
          </View>

          {Platform.OS === 'web' && (
            <Pressable
              onPress={() => router.push('/editor')}
              style={[styles.editorButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.editorButtonText}>Open Editor</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function QuickActionButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        { backgroundColor: colors.bgElevated, borderColor: colors.border },
        pressed && { backgroundColor: colors.bgHover, opacity: 0.7 },
      ]}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
  },
  aiButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing[8],
    borderRadius: radii.xl,
    borderWidth: 1,
    maxWidth: 400,
    width: '100%',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    marginBottom: spacing[2],
  },
  emptyDesc: {
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    justifyContent: 'center',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  quickActionIcon: {
    fontSize: 16,
  },
  quickActionLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  editorButton: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radii.md,
  },
  editorButtonText: {
    color: '#fff',
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});
