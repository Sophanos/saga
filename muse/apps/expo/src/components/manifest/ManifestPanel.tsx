/**
 * ManifestPanel - Cross-platform side panel
 *
 * Displays chapters/scenes, entities, and Story Bible in a tree structure.
 * Uses @mythos/manifest for shared tree logic.
 */

import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useState, useMemo } from 'react';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import { useCommandPaletteStore } from '@/stores/commandPalette';
import {
  useManifestTree,
  useTreeExpansion,
  useManifestSearch,
  type ManifestMemory,
} from '@mythos/manifest';
import type { Entity } from '@mythos/core';
import type { Document } from '@mythos/core/schema';

import { ManifestSection } from './ManifestSection';

// Mock data until Convex is wired up
const MOCK_DOCUMENTS: Document[] = [
  { id: 'ch1', projectId: 'p1', type: 'chapter', title: 'Chapter 1: The Beginning', orderIndex: 0, wordCount: 2500, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sc1', projectId: 'p1', type: 'scene', parentId: 'ch1', title: 'Scene 1: Dawn', orderIndex: 0, wordCount: 800, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sc2', projectId: 'p1', type: 'scene', parentId: 'ch1', title: 'Scene 2: Journey', orderIndex: 1, wordCount: 1200, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch2', projectId: 'p1', type: 'chapter', title: 'Chapter 2: The Conflict', orderIndex: 1, wordCount: 3200, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sc3', projectId: 'p1', type: 'scene', parentId: 'ch2', title: 'Scene 1: Tension', orderIndex: 0, wordCount: 1500, createdAt: new Date(), updatedAt: new Date() },
];

const MOCK_ENTITIES: Entity[] = [
  { id: 'e1', name: 'Marcus', type: 'character', aliases: ['Marc'], properties: {}, mentions: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'e2', name: 'Elena', type: 'character', aliases: [], properties: {}, mentions: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'e3', name: 'The Castle', type: 'location', aliases: ['Fortress'], properties: {}, mentions: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'e4', name: 'Enchanted Sword', type: 'item', aliases: [], properties: {}, mentions: [], createdAt: new Date(), updatedAt: new Date() },
];

const MOCK_MEMORIES: ManifestMemory[] = [
  { id: 'm1', category: 'decision', content: 'Marcus has blue eyes and brown hair', createdAt: new Date().toISOString(), metadata: { pinned: true } },
  { id: 'm2', category: 'decision', content: 'The story takes place in medieval times', createdAt: new Date().toISOString() },
  { id: 'm3', category: 'style', content: 'Use short, punchy sentences for action scenes', createdAt: new Date().toISOString() },
];

export function ManifestPanel() {
  const { colors } = useTheme();
  const { toggleSidebar } = useLayoutStore();
  const { open: openCommandPalette } = useCommandPaletteStore();

  // Search state
  const search = useManifestSearch();

  // TODO: Replace with Convex queries
  const documents = MOCK_DOCUMENTS;
  const entities = MOCK_ENTITIES;
  const memories = MOCK_MEMORIES;

  // Build manifest tree
  const manifestData = useManifestTree({
    documents,
    entities,
    memories,
    searchQuery: search.query,
  });

  // Expansion state - default expand chapters and story-bible
  const expansion = useTreeExpansion(['chapters', 'story-bible', 'character']);

  return (
    <View style={[styles.container, { borderRightColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.logo, { color: colors.text }]}>Mythos</Text>
        <Pressable
          onPress={toggleSidebar}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: pressed ? colors.bgHover : 'transparent' },
          ]}
        >
          <Feather name="sidebar" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Search */}
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
        <Text style={[styles.searchKbd, { color: colors.textMuted, backgroundColor: colors.bgHover }]}>K</Text>
      </Pressable>

      {/* Search Input (when searching) */}
      {search.isSearching && (
        <View style={[styles.searchInputRow, { borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search.query}
            onChangeText={search.setQuery}
            placeholder="Filter..."
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <Pressable onPress={search.clear}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {manifestData.sections.map((section) => (
          <ManifestSection
            key={section.id}
            section={section}
            expansion={expansion}
          />
        ))}

        {/* Empty state */}
        {manifestData.sections.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {search.isSearching
                ? 'No results found'
                : 'No content yet. Start writing!'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer stats */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          {manifestData.chapterCount} chapters - {manifestData.sceneCount} scenes
        </Text>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          {manifestData.totalWordCount.toLocaleString()} words
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  logo: {
    fontSize: typography.lg,
    fontWeight: '600',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[3],
    marginBottom: spacing[2],
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
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[3],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[2],
  },
  emptyState: {
    paddingVertical: spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
    fontStyle: 'italic',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 10,
  },
});
