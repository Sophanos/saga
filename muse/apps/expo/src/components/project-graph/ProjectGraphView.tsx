import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ReactFlowProvider } from '@xyflow/react';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { useProjectStore } from '@mythos/state';
import { useProjectGraph } from '@/hooks/useProjectGraph';
import { useProjectTypeRegistry } from '@/hooks/useProjectTypeRegistry';
import {
  getGraphEntityLabel,
  getRegistryEntityHexColor,
  type GraphEntityType,
} from '@mythos/core';
import { ProjectGraphCanvas } from './ProjectGraphCanvas';
import { ProjectGraphControls, type ProjectGraphTypeOption } from './ProjectGraphControls';

export function ProjectGraphView(): JSX.Element {
  const { colors } = useTheme();
  const router = useRouter();
  const projectId = useProjectStore((state) => state.currentProjectId);
  const registry = useProjectTypeRegistry();

  const allEntityTypes = useMemo<GraphEntityType[]>(() => {
    if (!registry) return [];
    return Object.keys(registry.entityTypes) as GraphEntityType[];
  }, [registry]);

  const allEntityTypesKey = useMemo(() => allEntityTypes.join(','), [allEntityTypes]);

  const [visibleTypes, setVisibleTypes] = useState<Set<GraphEntityType>>(
    () => new Set(allEntityTypes)
  );

  useEffect(() => {
    setVisibleTypes(new Set(allEntityTypes));
  }, [allEntityTypesKey]);

  const { nodes, edges, visibleEntityCount, visibleRelationshipCount } = useProjectGraph({
    visibleTypes,
    registry,
  });

  const typeOptions = useMemo<ProjectGraphTypeOption[]>(() => {
    if (!registry) return [];
    return Object.entries(registry.entityTypes).map(([type]) => ({
      type: type as GraphEntityType,
      label: getGraphEntityLabel(registry, type),
      color: getRegistryEntityHexColor(registry, type),
    }));
  }, [registry]);

  const handleToggleType = useCallback((type: GraphEntityType): void => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const [layoutKey, setLayoutKey] = useState(0);
  const handleResetLayout = useCallback((): void => {
    setLayoutKey((prev) => prev + 1);
  }, []);

  const handleBackToEditor = useCallback((): void => {
    router.push('/editor');
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]} testID="project-graph-view">
      <View style={[styles.header, { borderBottomColor: colors.border }]}> 
        <Pressable
          testID="project-graph-back-to-editor"
          onPress={handleBackToEditor}
          style={({ pressed, hovered }) => [
            styles.backButton,
            {
              backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.backText, { color: colors.text }]}>Back to editor</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Project Graph</Text>
      </View>

      {!projectId ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Select a project to view the graph.</Text>
        </View>
      ) : (
        <ReactFlowProvider>
          <View style={styles.canvas}>
            <ProjectGraphCanvas key={layoutKey} nodes={nodes} edges={edges} />
            <ProjectGraphControls
              visibleTypes={visibleTypes}
              onToggleType={handleToggleType}
              onResetLayout={handleResetLayout}
              entityCount={visibleEntityCount}
              relationshipCount={visibleRelationshipCount}
              typeOptions={typeOptions}
            />
          </View>
        </ReactFlowProvider>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderBottomWidth: 1,
  },
  backButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  backText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  title: {
    fontSize: typography.base,
    fontWeight: '700',
  },
  canvas: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
  },
});
