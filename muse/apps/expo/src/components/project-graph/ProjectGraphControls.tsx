import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, spacing, radii, typography } from '@/design-system';
import type { GraphEntityType } from '@mythos/core';

export interface ProjectGraphTypeOption {
  type: GraphEntityType;
  label: string;
  color?: string;
}

interface ProjectGraphControlsProps {
  visibleTypes: Set<GraphEntityType>;
  onToggleType: (type: GraphEntityType) => void;
  onResetLayout: () => void;
  entityCount: number;
  relationshipCount: number;
  typeOptions: ProjectGraphTypeOption[];
}

export function ProjectGraphControls({
  visibleTypes,
  onToggleType,
  onResetLayout,
  entityCount,
  relationshipCount,
  typeOptions,
}: ProjectGraphControlsProps): JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.filters, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        {typeOptions.map(({ type, label, color }) => {
          const isVisible = visibleTypes.has(type);
          return (
            <Pressable
              key={type}
              testID={`project-graph-toggle-${type}`}
              onPress={() => onToggleType(type)}
              style={({ pressed, hovered }) => [
                styles.filterChip,
                {
                  borderColor: isVisible ? color ?? colors.accent : colors.border,
                  backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
                  opacity: isVisible ? 1 : 0.45,
                },
              ]}
            >
              <Text style={[styles.filterText, { color: colors.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.stats, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Entities</Text>
          <Text style={[styles.statValue, { color: colors.text }]} testID="pg-entity-count">
            {entityCount}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Relationships</Text>
          <Text style={[styles.statValue, { color: colors.text }]} testID="pg-relationship-count">
            {relationshipCount}
          </Text>
        </View>
        <Pressable
          onPress={onResetLayout}
          testID="project-graph-reset-layout"
          style={({ pressed, hovered }) => [
            styles.resetButton,
            {
              backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.resetText, { color: colors.text }]}>Reset layout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    gap: spacing[2],
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  filterChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  statLabel: {
    fontSize: typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: typography.sm,
    fontWeight: '700',
  },
  resetButton: {
    marginLeft: 'auto',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  resetText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
});
