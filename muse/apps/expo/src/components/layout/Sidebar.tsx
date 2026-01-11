/**
 * Sidebar - Perplexity/Notion style
 * Project picker, chapters tree, entities, settings
 *
 * Uses @mythos/manifest for tree logic
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';
import { useTheme, spacing, typography, radii } from '@/design-system';
import { entityColors } from '@/design-system/colors';
import { useLayoutStore, useCommandPaletteStore, useProjectStore } from '@mythos/state';
import {
  useManifestTree,
  useTreeExpansion,
  type TreeNode,
  type ManifestSection,
  type ManifestMemory,
  type TreeExpansionState,
} from '@mythos/manifest';
import type { Entity } from '@mythos/core';
import type { Document } from '@mythos/core/schema';
import { ProjectPickerDropdown, CreateWorkspaceWizard } from '../projects';

export function Sidebar() {
  const { colors } = useTheme();
  const { toggleSidebar } = useLayoutStore();
  const { open: openCommandPalette } = useCommandPaletteStore();
  const router = useRouter();
  const currentProject = useProjectStore((s) => s.project);
  const projectName = currentProject?.name || 'Select Project';
  const projectInitial = projectName.charAt(0).toUpperCase();

  // Dropdown and wizard state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleOpenDropdown = useCallback(() => {
    setIsDropdownOpen(true);
  }, []);

  const handleCloseDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const handleOpenWizard = useCallback(() => {
    setIsWizardOpen(true);
  }, []);

  const handleCloseWizard = useCallback(() => {
    setIsWizardOpen(false);
  }, []);

  const handleProjectCreated = useCallback((projectId: string) => {
    // Project is already set in the wizard, just close
    console.log('[Sidebar] Project created:', projectId);
  }, []);

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
          style={({ pressed, hovered }) => [
            styles.projectPicker,
            {
              backgroundColor: pressed || hovered ? colors.bgHover : colors.bgElevated,
              borderColor: colors.border,
            },
          ]}
          onPress={handleOpenDropdown}
        >
          <View style={[styles.projectInitial, { backgroundColor: colors.bgHover }]}>
            <Text style={[styles.projectInitialText, { color: colors.text }]}>{projectInitial}</Text>
          </View>
          <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={1}>
            {projectName}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>

        {/* New Workspace (shortcut) */}
        <Pressable
          style={({ pressed, hovered }) => [
            styles.iconBtn,
            {
              borderColor: colors.border,
              backgroundColor: pressed || hovered ? colors.bgHover : 'transparent',
            },
          ]}
          onPress={handleOpenWizard}
        >
          <Feather name="plus" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Project Picker Dropdown */}
      <ProjectPickerDropdown
        visible={isDropdownOpen}
        onClose={handleCloseDropdown}
        onCreateNew={handleOpenWizard}
      />

      {/* Create Workspace Wizard */}
      <CreateWorkspaceWizard
        visible={isWizardOpen}
        onClose={handleCloseWizard}
        onCreated={handleProjectCreated}
      />

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
  const currentProject = useProjectStore((s) => s.project);
  const projectId = currentProject?.id as Id<'projects'> | undefined;

  // Convex queries - skip if no project selected
  const documentsQuery = useQuery(
    api.documents.list,
    projectId ? { projectId } : 'skip'
  );
  const entitiesQuery = useQuery(
    api.entities.list,
    projectId ? { projectId } : 'skip'
  );
  const memoriesQuery = useQuery(
    api.memories.list,
    projectId ? { projectId, pinnedOnly: true } : 'skip'
  );

  const isLoading = documentsQuery === undefined || entitiesQuery === undefined;

  // Map Convex data to manifest types
  const documents: Document[] = (documentsQuery ?? []).map((doc: any) => ({
    id: doc._id,
    projectId: doc.projectId,
    type: doc.type || 'chapter',
    title: doc.title || 'Untitled',
    parentId: doc.parentId,
    orderIndex: doc.orderIndex ?? 0,
    wordCount: doc.wordCount ?? 0,
    createdAt: new Date(doc._creationTime),
    updatedAt: new Date(doc._creationTime),
  }));

  const entities: Entity[] = (entitiesQuery ?? []).map((ent: any) => ({
    id: ent._id,
    name: ent.name || 'Unnamed',
    type: ent.type || 'character',
    aliases: ent.aliases ?? [],
    properties: ent.properties ?? {},
    mentions: [],
    createdAt: new Date(ent._creationTime),
    updatedAt: new Date(ent._creationTime),
  }));

  const memories: ManifestMemory[] = (memoriesQuery ?? []).map((mem: any) => ({
    id: mem._id,
    category: mem.type || 'decision',
    content: mem.text || '',
    createdAt: new Date(mem._creationTime).toISOString(),
    metadata: mem.pinned ? { pinned: true } : undefined,
  }));

  // Build manifest tree using shared logic
  const manifestData = useManifestTree({
    documents,
    entities,
    memories,
    searchQuery: '',
  });

  // Tree expansion state - default expand chapters
  const expansion = useTreeExpansion(['chapters']);

  if (!projectId) {
    return (
      <View style={styles.section}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Select a project to see content
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.section, { alignItems: 'center', paddingVertical: spacing[4] }]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    );
  }

  return (
    <>
      {manifestData.sections.map((section) => (
        <SidebarSection
          key={section.id}
          section={section}
          expansion={expansion}
        />
      ))}

      {/* Characters section (always show even if empty) */}
      {!manifestData.sections.find(s => s.type === 'characters') && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CHARACTERS</Text>
            <Pressable>
              <Text style={{ color: colors.textMuted }}>+</Text>
            </Pressable>
          </View>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No characters yet</Text>
        </View>
      )}

      {/* World section (always show even if empty) */}
      {!manifestData.sections.find(s => ['locations', 'items', 'magic-systems', 'factions'].includes(s.type)) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>WORLD</Text>
            <Pressable>
              <Text style={{ color: colors.textMuted }}>+</Text>
            </Pressable>
          </View>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No entities yet</Text>
        </View>
      )}
    </>
  );
}

interface SidebarSectionProps {
  section: ManifestSection;
  expansion: TreeExpansionState;
}

function SidebarSection({ section, expansion }: SidebarSectionProps) {
  const { colors } = useTheme();

  // Map section type to display title
  const getSectionTitle = () => {
    switch (section.type) {
      case 'chapters': return 'CHAPTERS';
      case 'characters': return 'CHARACTERS';
      case 'locations': return 'LOCATIONS';
      case 'items': return 'ITEMS';
      case 'magic-systems': return 'MAGIC SYSTEMS';
      case 'factions': return 'FACTIONS';
      case 'story-bible': return 'STORY BIBLE';
      case 'notes': return 'NOTES';
      case 'outlines': return 'OUTLINES';
      case 'worldbuilding': return 'WORLDBUILDING';
      default: return section.title.toUpperCase();
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {getSectionTitle()}
        </Text>
        <Pressable>
          <Text style={{ color: colors.textMuted }}>+</Text>
        </Pressable>
      </View>

      {section.children.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          expansion={expansion}
        />
      ))}

      {section.children.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No {section.title.toLowerCase()} yet
        </Text>
      )}
    </View>
  );
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  expansion: TreeExpansionState;
}

function TreeNodeRow({ node, depth, expansion }: TreeNodeRowProps) {
  const { colors } = useTheme();
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expansion.isExpanded(node.id);

  const getNodeIcon = (): string => {
    switch (node.type) {
      case 'chapter': return 'file-text';
      case 'scene': return 'circle';
      case 'folder': return 'folder';
      case 'entity':
        switch (node.entityType) {
          case 'character': return 'user';
          case 'location': return 'map-pin';
          case 'item': return 'box';
          case 'magic_system': return 'zap';
          case 'faction': return 'users';
          case 'event': return 'calendar';
          case 'concept': return 'lightbulb';
          default: return 'circle';
        }
      case 'memory': return 'bookmark';
      case 'note': return 'edit-3';
      default: return 'circle';
    }
  };

  const getNodeColor = (): string | undefined => {
    if (node.entityType) {
      switch (node.entityType) {
        case 'character': return entityColors.character;
        case 'location': return entityColors.location;
        case 'item': return entityColors.item;
        case 'magic_system': return entityColors.magic;
        case 'faction': return entityColors.faction;
        default: return undefined;
      }
    }
    return undefined;
  };

  const iconColor = getNodeColor();

  // Chapter row with expand button
  if (node.type === 'chapter') {
    return (
      <View>
        <View style={styles.chapterRow}>
          <Pressable onPress={() => expansion.toggle(node.id)} style={styles.expandBtn}>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </Pressable>
          <SidebarItem
            icon={getNodeIcon()}
            label={node.name}
            onPress={() => {}}
            active={false}
          />
        </View>
        {isExpanded && hasChildren && (
          <View style={[styles.scenesContainer, { borderLeftColor: colors.border }]}>
            <Text style={[styles.scenesLabel, { color: colors.textMuted }]}>SCENES</Text>
            {node.children!.map((child) => (
              <TreeNodeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                expansion={expansion}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  // Scene row (indented)
  if (node.type === 'scene') {
    return (
      <SidebarItem
        icon={getNodeIcon()}
        label={node.name}
        onPress={() => {}}
        small
      />
    );
  }

  // Entity row
  if (node.type === 'entity') {
    return (
      <SidebarItem
        icon={getNodeIcon()}
        label={node.name}
        onPress={() => {}}
        iconColor={iconColor}
      />
    );
  }

  // Folder row (expandable)
  if (node.type === 'folder' && hasChildren) {
    return (
      <View>
        <Pressable
          onPress={() => expansion.toggle(node.id)}
          style={({ pressed }) => [
            styles.item,
            pressed && { backgroundColor: colors.sidebarItemHover },
          ]}
        >
          <Text style={{ color: colors.textMuted, fontSize: 10, width: 16 }}>
            {isExpanded ? '▼' : '▶'}
          </Text>
          <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>
            {node.name}
          </Text>
        </Pressable>
        {isExpanded && (
          <View style={{ marginLeft: spacing[3] }}>
            {node.children!.map((child) => (
              <TreeNodeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                expansion={expansion}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  // Default row
  return (
    <SidebarItem
      icon={getNodeIcon()}
      label={node.name}
      onPress={() => {}}
    />
  );
}

interface SidebarItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  small?: boolean;
  shortcut?: string;
  iconColor?: string;
}

function SidebarItem({ icon, label, onPress, active, small, shortcut, iconColor }: SidebarItemProps) {
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
      <View style={[
        styles.itemIcon,
        { backgroundColor: iconColor ? `${iconColor}20` : colors.bgHover }
      ]}>
        <Feather name={icon as any} size={small ? 10 : 14} color={iconColor || colors.textMuted} />
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
