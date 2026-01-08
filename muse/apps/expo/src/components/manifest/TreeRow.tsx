/**
 * TreeRow - Generic tree node row component
 *
 * Renders different node types: chapters, scenes, entities, memories, folders.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii } from '@/design-system';
import { entityColors } from '@/design-system/colors';
import type { TreeNode, TreeExpansionState } from '@mythos/manifest';

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  expansion: TreeExpansionState;
  onSelect?: (node: TreeNode) => void;
}

/**
 * Get icon name for node type.
 */
function getNodeIcon(node: TreeNode): keyof typeof Feather.glyphMap {
  switch (node.type) {
    case 'folder':
      return 'folder';
    case 'chapter':
      return 'book-open';
    case 'scene':
      return 'file-text';
    case 'entity':
      switch (node.entityType) {
        case 'character':
          return 'user';
        case 'location':
          return 'map-pin';
        case 'item':
          return 'box';
        case 'magic_system':
          return 'zap';
        case 'faction':
          return 'users';
        default:
          return 'circle';
      }
    case 'memory':
      if (node.memoryCategory === 'decision') return 'bookmark';
      if (node.memoryCategory === 'style') return 'edit-3';
      return 'heart';
    case 'note':
      return 'file';
    case 'outline':
      return 'list';
    case 'worldbuilding':
      return 'globe';
    default:
      return 'circle';
  }
}

/**
 * Get icon color for node type.
 */
function getNodeColor(node: TreeNode, defaultColor: string): string {
  if (node.color) return node.color;

  switch (node.entityType) {
    case 'character':
      return entityColors.character;
    case 'location':
      return entityColors.location;
    case 'item':
      return entityColors.item;
    case 'magic_system':
      return entityColors.magic;
    case 'faction':
      return entityColors.faction;
    default:
      return defaultColor;
  }
}

export function TreeRow({ node, depth, expansion, onSelect }: TreeRowProps) {
  const { colors } = useTheme();
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expansion.isExpanded(node.id);
  const icon = getNodeIcon(node);
  const iconColor = getNodeColor(node, colors.textSecondary);

  const handlePress = () => {
    if (hasChildren) {
      expansion.toggle(node.id);
    }
    onSelect?.(node);
  };

  return (
    <View>
      <Pressable
        onPress={handlePress}
        style={({ pressed, hovered }) => [
          styles.row,
          { paddingLeft: spacing[2] + depth * spacing[3] },
          (pressed || hovered) && { backgroundColor: colors.bgHover },
        ]}
      >
        {/* Expand/collapse chevron */}
        <View style={styles.chevronContainer}>
          {hasChildren ? (
            <Feather
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={12}
              color={colors.textMuted}
            />
          ) : (
            <View style={styles.chevronPlaceholder} />
          )}
        </View>

        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Feather name={icon} size={12} color={iconColor} />
        </View>

        {/* Label */}
        <Text
          style={[styles.label, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {node.name}
        </Text>

        {/* Word count (for documents) */}
        {node.wordCount !== undefined && node.wordCount > 0 && (
          <Text style={[styles.wordCount, { color: colors.textMuted }]}>
            {formatWordCount(node.wordCount)}
          </Text>
        )}

        {/* Pinned indicator (for memories) */}
        {node.memory?.metadata?.pinned && (
          <Feather name="lock" size={10} color={entityColors.item} />
        )}
      </Pressable>

      {/* Children */}
      {isExpanded && hasChildren && (
        <View>
          {node.children!.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expansion={expansion}
              onSelect={onSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Format word count for display.
 */
function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1] + 2,
    paddingRight: spacing[2],
    borderRadius: radii.sm,
    gap: spacing[2],
  },
  chevronContainer: {
    width: 16,
    alignItems: 'center',
  },
  chevronPlaceholder: {
    width: 12,
  },
  iconContainer: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: typography.sm,
  },
  wordCount: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
