/**
 * ArtifactTabBar - Tab bar for switching between artifacts
 *
 * Features:
 * - Horizontal scrollable tabs
 * - Active tab highlight
 * - Close button per tab
 * - New tab button
 * - Right-click context menu (rename, duplicate, merge, close)
 */

import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { buildRheiUrl } from '@mythos/core';
import {
  useArtifactStore,
  useArtifacts,
  useActiveArtifact,
  useProjectStore,
  ARTIFACT_TYPE_ICONS,
  type Artifact,
} from '@mythos/state';

interface ArtifactTabBarProps {
  onNewTab?: () => void;
}

export function ArtifactTabBar({ onNewTab }: ArtifactTabBarProps) {
  const { colors } = useTheme();
  const artifacts = useArtifacts();
  const activeArtifact = useActiveArtifact();
  const { setActiveArtifact, removeArtifact } = useArtifactStore();
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  if (artifacts.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {artifacts.map((artifact) => (
          <ArtifactTab
            key={artifact.id}
            artifact={artifact}
            isActive={artifact.id === activeArtifact?.id}
            onSelect={() => setActiveArtifact(artifact.id)}
            onClose={() => removeArtifact(artifact.id)}
            onContextMenu={() => setContextMenuId(artifact.id)}
            showContextMenu={contextMenuId === artifact.id}
            onCloseContextMenu={() => setContextMenuId(null)}
          />
        ))}
      </ScrollView>

      {/* New tab button */}
      {onNewTab && (
        <Pressable
          onPress={onNewTab}
          style={({ pressed }) => [
            styles.newTabBtn,
            { backgroundColor: pressed ? colors.bgHover : 'transparent' },
          ]}
        >
          <Feather name="plus" size={14} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

interface ArtifactTabProps {
  artifact: Artifact;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu: () => void;
  showContextMenu: boolean;
  onCloseContextMenu: () => void;
}

function ArtifactTab({
  artifact,
  isActive,
  onSelect,
  onClose,
  onContextMenu,
  showContextMenu,
  onCloseContextMenu,
}: ArtifactTabProps) {
  const { colors } = useTheme();
  const iconName = ARTIFACT_TYPE_ICONS[artifact.type] as keyof typeof Feather.glyphMap;

  return (
    <View style={styles.tabWrapper}>
      <Pressable
        onPress={onSelect}
        onLongPress={onContextMenu}
        style={({ pressed }) => [
          styles.tab,
          {
            backgroundColor: isActive
              ? colors.bgActive
              : pressed
              ? colors.bgHover
              : 'transparent',
            borderBottomColor: isActive ? colors.accent : 'transparent',
          },
        ]}
      >
        <Feather
          name={iconName}
          size={12}
          color={isActive ? colors.accent : colors.textMuted}
        />
        <Text
          style={[
            styles.tabTitle,
            { color: isActive ? colors.text : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {artifact.title}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={styles.closeBtn}
          hitSlop={4}
        >
          <Feather name="x" size={12} color={colors.textMuted} />
        </Pressable>
      </Pressable>

      {/* Context menu */}
      {showContextMenu && (
        <TabContextMenu
          artifact={artifact}
          onClose={onCloseContextMenu}
        />
      )}
    </View>
  );
}

interface TabContextMenuProps {
  artifact: Artifact;
  onClose: () => void;
}

function TabContextMenu({ artifact, onClose }: TabContextMenuProps) {
  const { colors } = useTheme();
  const store = useArtifactStore();
  const artifacts = useArtifacts();
  const projectId = useProjectStore((s) => s.currentProjectId);
  const [showRename, setShowRename] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [renameValue, setRenameValue] = useState(artifact.title);

  const handleCopyLink = async () => {
    if (!projectId) return;
    const link = buildRheiUrl({
      target: 'artifact',
      projectId,
      artifactKey: artifact.id,
    });
    await Clipboard.setStringAsync(link);
    onClose();
  };

  const handleRename = () => {
    store.updateArtifact(artifact.id, { title: renameValue });
    setShowRename(false);
    onClose();
  };

  const handleDuplicate = () => {
    store.duplicateArtifact(artifact.id);
    onClose();
  };

  const handleBranch = () => {
    store.branchFromArtifact(artifact.id);
    onClose();
  };

  const handleMergeInto = (targetId: string) => {
    store.mergeTabs(artifact.id, targetId);
    setShowMerge(false);
    onClose();
  };

  // Show rename input
  if (showRename) {
    return (
      <>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          entering={FadeIn.duration(100)}
          exiting={FadeOut.duration(75)}
          style={[styles.contextMenu, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        >
          <View style={styles.renameInput}>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
              autoFocus
              onSubmitEditing={handleRename}
            />
            <View style={styles.renameButtons}>
              <Pressable onPress={() => setShowRename(false)} style={styles.cancelBtn}>
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleRename} style={[styles.confirmBtn, { backgroundColor: colors.accent }]}>
                <Text style={{ color: colors.bgApp }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </>
    );
  }

  // Show merge target list
  if (showMerge) {
    const otherTabs = artifacts.filter((a) => a.id !== artifact.id);
    return (
      <>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          entering={FadeIn.duration(100)}
          exiting={FadeOut.duration(75)}
          style={[styles.contextMenu, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        >
          <Text style={[styles.menuHeader, { color: colors.textMuted }]}>Merge into:</Text>
          {otherTabs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No other tabs</Text>
          ) : (
            otherTabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => handleMergeInto(tab.id)}
                style={({ pressed }) => [
                  styles.contextMenuItem,
                  { backgroundColor: pressed ? colors.bgHover : 'transparent' },
                ]}
              >
                <Feather name={ARTIFACT_TYPE_ICONS[tab.type] as keyof typeof Feather.glyphMap} size={14} color={colors.textMuted} />
                <Text style={[styles.contextMenuText, { color: colors.text }]} numberOfLines={1}>
                  {tab.title}
                </Text>
              </Pressable>
            ))
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={() => setShowMerge(false)}
            style={({ pressed }) => [
              styles.contextMenuItem,
              { backgroundColor: pressed ? colors.bgHover : 'transparent' },
            ]}
          >
            <Feather name="arrow-left" size={14} color={colors.textMuted} />
            <Text style={[styles.contextMenuText, { color: colors.textMuted }]}>Back</Text>
          </Pressable>
        </Animated.View>
      </>
    );
  }

  const actions = [
    { id: 'rename', label: 'Rename', icon: 'edit-2' as const, onPress: () => setShowRename(true) },
    { id: 'duplicate', label: 'Duplicate', icon: 'copy' as const, onPress: handleDuplicate },
    { id: 'branch', label: 'Branch', icon: 'git-branch' as const, onPress: handleBranch },
    { id: 'merge', label: 'Merge into...', icon: 'git-merge' as const, onPress: () => setShowMerge(true) },
    { id: 'divider1', label: '', icon: 'minus' as const, onPress: () => {} },
    ...(projectId ? [{ id: 'copylink', label: 'Copy link', icon: 'link' as const, onPress: handleCopyLink }] : []),
    { id: 'divider2', label: '', icon: 'minus' as const, onPress: () => {} },
    { id: 'close', label: 'Close', icon: 'x' as const, onPress: () => { store.removeArtifact(artifact.id); onClose(); } },
  ];

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(100)}
        exiting={FadeOut.duration(75)}
        style={[styles.contextMenu, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
      >
        {actions.map((action) =>
          action.id.startsWith('divider') ? (
            <View key={action.id} style={[styles.divider, { backgroundColor: colors.border }]} />
          ) : (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.contextMenuItem,
                { backgroundColor: pressed ? colors.bgHover : 'transparent' },
              ]}
            >
              <Feather name={action.icon} size={14} color={colors.textMuted} />
              <Text style={[styles.contextMenuText, { color: colors.text }]}>
                {action.label}
              </Text>
            </Pressable>
          )
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tabsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
  },
  tabWrapper: {
    position: 'relative',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
    borderBottomWidth: 2,
    maxWidth: 160,
  },
  tabTitle: {
    fontSize: typography.xs,
    flexShrink: 1,
  },
  closeBtn: {
    padding: spacing[0.5],
    marginLeft: spacing[0.5],
  },
  newTabBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPickerWrapper: {
    position: 'relative',
    marginLeft: spacing[0.5],
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  contextMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    minWidth: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing[1],
    zIndex: 100,
    marginTop: spacing[1],
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  contextMenuText: {
    fontSize: typography.sm,
  },
  divider: {
    height: 1,
    marginVertical: spacing[1],
  },
  renameInput: {
    padding: spacing[3],
  },
  textInput: {
    fontSize: typography.sm,
    padding: spacing[2],
    borderWidth: 1,
    borderRadius: radii.md,
    marginBottom: spacing[2],
  },
  renameButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  cancelBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  confirmBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
  },
  menuHeader: {
    fontSize: typography.xs,
    fontWeight: typography.medium as any,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  emptyText: {
    fontSize: typography.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
});
