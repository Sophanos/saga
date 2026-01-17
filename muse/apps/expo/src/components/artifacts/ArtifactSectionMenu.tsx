/**
 * ArtifactSectionMenu - Context menu (⋮) for artifact sections
 *
 * Actions:
 * - Edit
 * - Collapse/Expand
 * - Branch (opens in new tab)
 * - Copy link (deep link to section)
 * - Remove
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme, spacing, radii, typography, statusColors } from '@/design-system';
import { buildRheiUrl } from '@mythos/core';
import { useProjectStore } from '@mythos/state';

interface ArtifactSectionMenuProps {
  artifactKey: string;
  sectionId: string;
  sectionTitle?: string;
  isCollapsed?: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onToggleCollapse?: () => void;
  onBranch?: () => void;
  onRemove?: () => void;
}

export function ArtifactSectionMenu({
  artifactKey,
  sectionId,
  sectionTitle,
  isCollapsed = false,
  visible,
  onClose,
  onEdit,
  onToggleCollapse,
  onBranch,
  onRemove,
}: ArtifactSectionMenuProps) {
  const { colors } = useTheme();
  const projectId = useProjectStore((s) => s.currentProjectId);

  if (!visible) return null;

  const handleCopyLink = async () => {
    if (!projectId) return;

    const link = buildRheiUrl({
      target: 'artifact',
      projectId,
      artifactKey,
      focusId: sectionId,
    });

    await Clipboard.setStringAsync(link);
    onClose();
  };

  type IconName = keyof typeof Feather.glyphMap;
  const actions: Array<{ id: string; label: string; icon: IconName; onPress: () => void; danger?: boolean }> = [
    { id: 'edit', label: 'Edit', icon: 'edit-2', onPress: () => { onEdit?.(); onClose(); } },
    { id: 'collapse', label: isCollapsed ? 'Expand' : 'Collapse', icon: isCollapsed ? 'chevron-down' : 'chevron-up', onPress: () => { onToggleCollapse?.(); onClose(); } },
    { id: 'branch', label: 'Branch to new tab', icon: 'git-branch', onPress: () => { onBranch?.(); onClose(); } },
    { id: 'copy-link', label: 'Copy link', icon: 'link', onPress: handleCopyLink },
    { id: 'divider', label: '', icon: 'minus', onPress: () => {} },
    { id: 'remove', label: 'Remove', icon: 'trash-2', onPress: () => { onRemove?.(); onClose(); }, danger: true },
  ];

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(100)}
        exiting={FadeOut.duration(75)}
        style={[styles.menu, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
      >
        {sectionTitle && (
          <View style={styles.header}>
            <Text style={[styles.headerText, { color: colors.textMuted }]} numberOfLines={1}>
              {sectionTitle}
            </Text>
          </View>
        )}
        {actions.map((action) =>
          action.id === 'divider' ? (
            <View key={action.id} style={[styles.divider, { backgroundColor: colors.border }]} />
          ) : (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.menuItem,
                { backgroundColor: pressed ? colors.bgHover : 'transparent' },
              ]}
            >
              <Feather
                name={action.icon}
                size={14}
                color={action.danger ? statusColors.error : colors.textMuted}
              />
              <Text
                style={[
                  styles.menuText,
                  { color: action.danger ? statusColors.error : colors.text },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          )
        )}
      </Animated.View>
    </>
  );
}

/**
 * Trigger button for section menu
 */
interface SectionMenuTriggerProps {
  onPress: () => void;
}

export function SectionMenuTrigger({ onPress }: SectionMenuTriggerProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        { backgroundColor: pressed ? colors.bgHover : 'transparent' },
      ]}
      hitSlop={8}
    >
      <Feather name="more-vertical" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    minWidth: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing[1],
    zIndex: 100,
    marginTop: spacing[1],
  },
  header: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerText: {
    fontSize: typography.xs,
    fontWeight: typography.medium as any,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  menuText: {
    fontSize: typography.sm,
  },
  divider: {
    height: 1,
    marginVertical: spacing[1],
  },
  trigger: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
