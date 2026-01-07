/**
 * Sidebar - Perplexity/Notion style
 * Project picker, chapters tree, entities, settings
 */

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme, spacing, sizing, typography, radii, entityColors } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';

// Entity type config
const ENTITY_TYPES = [
  { type: 'character', icon: '🎭', label: 'Character' },
  { type: 'location', icon: '🗺', label: 'Location' },
  { type: 'item', icon: '⚔️', label: 'Item' },
  { type: 'magic', icon: '✨', label: 'Magic System' },
  { type: 'faction', icon: '👥', label: 'Faction' },
  { type: 'event', icon: '📅', label: 'Event' },
  { type: 'concept', icon: '💡', label: 'Concept' },
] as const;

export function Sidebar() {
  const { colors } = useTheme();
  const { sidebarCollapsed, toggleSidebar } = useLayoutStore();
  const router = useRouter();

  if (sidebarCollapsed) {
    return <CollapsedSidebar />;
  }

  return (
    <View style={[styles.container, { borderRightColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.text }]}>📖 Mythos</Text>
        <Pressable onPress={toggleSidebar} style={styles.collapseBtn}>
          <Text style={{ color: colors.textMuted }}>◀</Text>
        </Pressable>
      </View>

      {/* Project Picker */}
      <View style={styles.projectRow}>
        <Pressable
          style={[styles.projectPicker, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        >
          <View style={[styles.projectInitial, { backgroundColor: colors.bgHover }]}>
            <Text style={[styles.projectInitialText, { color: colors.text }]}>L</Text>
          </View>
          <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={1}>
            LOTR_SLAVIC
          </Text>
          <Text style={{ color: colors.textMuted }}>▾</Text>
        </Pressable>

        {/* New Chapter */}
        <Pressable style={[styles.iconBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted }}>+</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ProjectView />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <SidebarItem icon="⌘" label="Shortcuts" onPress={() => {}} />
        <SidebarItem icon="⚙" label="Settings" onPress={() => router.push('/settings')} />
      </View>
    </View>
  );
}

function CollapsedSidebar() {
  const { colors } = useTheme();
  const { toggleSidebar, toggleAIPanel } = useLayoutStore();

  return (
    <View style={[styles.collapsed, { borderRightColor: colors.border }]}>
      <Pressable onPress={toggleSidebar} style={styles.collapsedBtn}>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>☰</Text>
      </Pressable>

      <View style={styles.collapsedIcons}>
        <Pressable style={styles.collapsedBtn}>
          <Text style={{ color: colors.textMuted }}>🏠</Text>
        </Pressable>
        <Pressable style={styles.collapsedBtn}>
          <Text style={{ color: colors.textMuted }}>🔍</Text>
        </Pressable>
        <Pressable onPress={toggleAIPanel} style={styles.collapsedBtn}>
          <Text style={{ color: colors.textMuted }}>🤖</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProjectView() {
  const { colors } = useTheme();
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({ ch1: true });

  // Mock data - replace with Convex query
  const chapters = [
    { id: 'ch1', title: 'Chapter 1', scenes: [{ id: 'sc1', title: 'Scene 1' }] },
  ];
  const characters: any[] = [];
  const worldEntities: any[] = [];

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {/* Chapters */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CHAPTERS</Text>
          <Pressable>
            <Text style={{ color: colors.textMuted }}>+</Text>
          </Pressable>
        </View>
        {chapters.map((ch) => (
          <View key={ch.id}>
            <View style={styles.chapterRow}>
              <Pressable onPress={() => toggleChapter(ch.id)} style={styles.expandBtn}>
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                  {expandedChapters[ch.id] ? '▼' : '▶'}
                </Text>
              </Pressable>
              <SidebarItem icon="📄" label={ch.title} onPress={() => {}} active />
            </View>
            {expandedChapters[ch.id] && (
              <View style={[styles.scenesContainer, { borderLeftColor: colors.border }]}>
                <Text style={[styles.scenesLabel, { color: colors.textMuted }]}>SCENES</Text>
                {ch.scenes.map((sc) => (
                  <SidebarItem key={sc.id} icon="●" label={sc.title} onPress={() => {}} small />
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Characters */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CHARACTERS</Text>
          <Pressable>
            <Text style={{ color: colors.textMuted }}>+</Text>
          </Pressable>
        </View>
        {characters.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No characters yet</Text>
        )}
      </View>

      {/* World */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>WORLD</Text>
          <Pressable>
            <Text style={{ color: colors.textMuted }}>+</Text>
          </Pressable>
        </View>
        {worldEntities.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No entities yet</Text>
        )}
      </View>
    </>
  );
}

interface SidebarItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  small?: boolean;
}

function SidebarItem({ icon, label, onPress, active, small }: SidebarItemProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        active && { backgroundColor: colors.sidebarItemActive },
        pressed && { backgroundColor: colors.sidebarItemHover, opacity: 0.7 },
      ]}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.bgHover }]}>
        <Text style={[styles.itemIconText, { color: colors.text }, small && { fontSize: 8 }]}>{icon}</Text>
      </View>
      <Text style={[styles.itemLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  collapsed: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing[4],
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  collapsedBtn: {
    padding: spacing[2],
    minWidth: sizing.minTouchTarget,
    minHeight: sizing.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedIcons: {
    marginTop: spacing[4],
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  logo: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  collapseBtn: {
    padding: spacing[2],
  },
  projectRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  projectPicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  projectInitial: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInitialText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  projectName: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: spacing[2],
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.medium,
    letterSpacing: 0.5,
    paddingVertical: spacing[2],
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scenesContainer: {
    marginLeft: spacing[5],
    paddingLeft: spacing[3],
    borderLeftWidth: 1,
    marginTop: spacing[1],
  },
  scenesLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    paddingVertical: spacing[1],
  },
  emptyText: {
    fontSize: typography.xs,
    paddingLeft: spacing[2],
    fontStyle: 'italic',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    gap: spacing[2],
  },
  itemIcon: {
    width: 24,
    height: 24,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconText: {
    fontSize: 11,
  },
  itemLabel: {
    flex: 1,
    fontSize: typography.sm,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
});
