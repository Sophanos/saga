import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ReactFlowProvider } from '@xyflow/react';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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
import { RegistryEditorModal } from './RegistryEditorModal';

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
  const [showRegistryModal, setShowRegistryModal] = useState(false);

  const handleResetLayout = useCallback((): void => {
    setLayoutKey((prev) => prev + 1);
  }, []);

  const handleBackToEditor = useCallback((): void => {
    router.push('/editor');
  }, [router]);

  const handleOpenRegistry = useCallback((): void => {
    setShowRegistryModal(true);
  }, []);

  const handleCloseRegistry = useCallback((): void => {
    setShowRegistryModal(false);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]} testID="project-graph-view">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Feather name="git-branch" size={18} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]}>Project Graph</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            testID="project-graph-registry"
            onPress={handleOpenRegistry}
            style={({ pressed, hovered }) => [
              styles.headerButton,
              {
                backgroundColor: pressed || hovered ? colors.bgHover : 'transparent',
              },
            ]}
          >
            <Feather name="settings" size={14} color={colors.textMuted} />
            <Text style={[styles.headerButtonText, { color: colors.textMuted }]}>Registry</Text>
          </Pressable>
          <Pressable
            testID="project-graph-back-to-editor"
            onPress={handleBackToEditor}
            style={({ pressed, hovered }) => [
              styles.headerButton,
              {
                backgroundColor: pressed || hovered ? colors.bgHover : 'transparent',
              },
            ]}
          >
            <Feather name="file-text" size={14} color={colors.textMuted} />
            <Text style={[styles.headerButtonText, { color: colors.textMuted }]}>Editor</Text>
          </Pressable>
        </View>
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

      {showRegistryModal && <RegistryEditorModal onClose={handleCloseRegistry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 48,
    paddingHorizontal: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[2.5],
    borderRadius: radii.md,
  },
  headerButtonText: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
  title: {
    fontSize: typography.sm,
    fontWeight: '600',
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
