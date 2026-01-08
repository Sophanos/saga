/**
 * ManifestSection - Collapsible section in the manifest panel
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii } from '@/design-system';
import type { ManifestSection as ManifestSectionType, TreeExpansionState } from '@mythos/manifest';

import { TreeRow } from './TreeRow';

interface ManifestSectionProps {
  section: ManifestSectionType;
  expansion: TreeExpansionState;
}

export function ManifestSection({ section, expansion }: ManifestSectionProps) {
  const { colors } = useTheme();
  const isExpanded = expansion.isExpanded(section.id);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Pressable
        onPress={() => expansion.toggle(section.id)}
        style={({ pressed, hovered }) => [
          styles.header,
          (pressed || hovered) && { backgroundColor: colors.bgHover },
        ]}
      >
        <Feather
          name={isExpanded ? 'chevron-down' : 'chevron-right'}
          size={12}
          color={colors.textMuted}
        />
        <Text style={[styles.title, { color: colors.textMuted }]}>
          {section.title.toUpperCase()}
        </Text>
        {section.count !== undefined && section.count > 0 && (
          <Text style={[styles.count, { color: colors.textMuted }]}>
            {section.count}
          </Text>
        )}
        <View style={styles.spacer} />
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            // TODO: Add item action
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: pressed ? colors.bgActive : 'transparent' },
          ]}
        >
          <Feather name="plus" size={12} color={colors.textMuted} />
        </Pressable>
      </Pressable>

      {/* Section Children */}
      {isExpanded && (
        <View style={styles.children}>
          {section.children.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              expansion={expansion}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radii.sm,
    gap: spacing[1],
  },
  title: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  count: {
    fontSize: 10,
  },
  spacer: {
    flex: 1,
  },
  addBtn: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  children: {
    marginLeft: spacing[1],
  },
});
