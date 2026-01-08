/**
 * Sidebar - Perplexity/Notion style
 * Project picker, chapters tree, entities, settings
 */

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import { useCommandPaletteStore } from '@/stores/commandPalette';

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
  const { toggleSidebar } = useLayoutStore();
  const { open: openCommandPalette } = useCommandPaletteStore();
  const router = useRouter();

  return (
    <View style={[styles.container, { borderRightColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.text }]}>📖 Mythos</Text>
        <Pressable
          onPress={toggleSidebar}
          style={({ pressed }) => [
            styles.collapseBtn,
            { backgroundColor: pressed ? colors.bgHover : 'transparent' },
          ]}
        >
          <Feather name="sidebar" size={18} color={colors.textMuted} />
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

      {/* Quick Search */}
      <Pressable
        onPress={openCommandPalette}
        style={({ pressed, hovered }) => [
          styles.searchRow,
          { borderColor: colors.border },
          (pressed || hovered) && { backgroundColor: colors.bgHover },
        ]}
      >
        <Feather name="search" size={14} color={colors.textMuted} />
        <Text style={[styles.searchText, { color: colors.textMuted }]}>Quick search...</Text>
        <Text style={[styles.searchKbd, { color: colors.textMuted, backgroundColor: colors.bgHover }]}>⌘K</Text>
      </Pressable>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ProjectView />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <SidebarItem icon="settings" label="Settings" shortcut="⌘," onPress={() => router.push('/settings')} />
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
  shortcut?: string;
}

function SidebarItem({ icon, label, onPress, active, small, shortcut }: SidebarItemProps) {
  const { colors } = useTheme();
  const isFeatherIcon = !icon.match(/[\u{1F300}-\u{1F9FF}]/u) && icon.length > 1;

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
        {isFeatherIcon ? (
          <Feather name={icon as any} size={small ? 10 : 14} color={colors.textMuted} />
        ) : (
          <Text style={[styles.itemIconText, { color: colors.text }, small && { fontSize: 8 }]}>{icon}</Text>
        )}
      </View>
      <Text style={[styles.itemLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      {shortcut && (
        <Text style={[styles.shortcut, { color: colors.textMuted }]}>{shortcut}</Text>
      )}
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
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  logo: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[3],
    marginBottom: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[2],
  },
  searchText: {
    flex: 1,
    fontSize: typography.sm,
  },
  searchKbd: {
    fontSize: 10,
    fontFamily: 'monospace',
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.sm,
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
  shortcut: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
});
