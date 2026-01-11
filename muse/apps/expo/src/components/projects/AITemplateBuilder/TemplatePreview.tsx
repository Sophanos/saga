/**
 * TemplatePreview - Shows blueprint or generated draft preview
 */

import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii, palette } from '@/design-system';
import type { GenesisEntity, TemplateDraft, TemplateEntityKind } from '@mythos/agent-protocol';
import {
  PROJECT_TYPE_BLUEPRINTS,
  PROJECT_TYPE_DEFS,
  type ProjectType,
  type TemplateBuilderPhase,
} from '@mythos/core';

interface TemplatePreviewProps {
  projectType: ProjectType;
  phase: TemplateBuilderPhase;
  draft: TemplateDraft | null;
  starterEntities: GenesisEntity[];
  isGenerating: boolean;
  isReadyToGenerate: boolean;
  onUseTemplate: () => void;
  onCancel?: () => void;
  onRefine?: () => void;
}

interface BlueprintSectionProps {
  title: string;
  items: string[];
}

function BlueprintSection({ title, items }: BlueprintSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.blueprintSection}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
      <View style={styles.chipContainer}>
        {items.map((item) => (
          <View key={item} style={[styles.chip, { backgroundColor: colors.bgSurface }]}>
            <Text style={[styles.chipText, { color: colors.textMuted }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface DraftPreviewProps {
  draft: TemplateDraft;
  starterEntities: GenesisEntity[];
  onAccept: () => void;
  onRefine?: () => void;
  onCancel?: () => void;
}

function DraftPreview({ draft, starterEntities, onAccept, onRefine, onCancel }: DraftPreviewProps) {
  const { colors } = useTheme();

  return (
    <ScrollView style={styles.draftContainer} showsVerticalScrollIndicator={false}>
      {/* Template Name */}
      <View style={styles.draftHeader}>
        <Feather name="check-circle" size={20} color={palette.green[400]} />
        <Text style={[styles.draftTitle, { color: colors.text }]}>
          {draft.name || 'Custom Template'}
        </Text>
      </View>

      {/* Entity Kinds */}
      {draft.entityKinds && draft.entityKinds.length > 0 && (
        <View style={styles.draftSection}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ENTITY KINDS</Text>
          <View style={styles.kindList}>
            {draft.entityKinds.slice(0, 6).map((kind: TemplateEntityKind) => (
              <View
                key={kind.kind}
                style={[styles.kindItem, { backgroundColor: colors.bgSurface }]}
              >
                <View
                  style={[styles.kindDot, { backgroundColor: kind.color || palette.purple[400] }]}
                />
                <Text style={[styles.kindName, { color: colors.text }]}>{kind.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Starter Entities */}
      {starterEntities.length > 0 && (
        <View style={styles.draftSection}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>STARTER ENTITIES</Text>
          <View style={styles.starterList}>
            {starterEntities.slice(0, 4).map((entity, idx) => (
              <View
                key={`${entity.type}-${idx}`}
                style={[styles.starterItem, { backgroundColor: colors.bgSurface }]}
              >
                <Text style={[styles.starterName, { color: colors.text }]}>{entity.name}</Text>
                <Text style={[styles.starterKind, { color: colors.textMuted }]}>{entity.type}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: pressed ? palette.green[500] : palette.green[400],
            },
          ]}
          onPress={onAccept}
        >
          <Text style={styles.primaryButtonText}>Use This Template</Text>
        </Pressable>

        <View style={styles.secondaryActions}>
          {onRefine && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: pressed ? colors.bgHover : 'transparent' },
              ]}
              onPress={onRefine}
            >
              <Feather name="edit-2" size={14} color={colors.textSecondary} />
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                Refine
              </Text>
            </Pressable>
          )}
          {onCancel && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: pressed ? colors.bgHover : 'transparent' },
              ]}
              onPress={onCancel}
            >
              <Feather name="x" size={14} color={colors.textSecondary} />
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

export function TemplatePreview({
  projectType,
  phase,
  draft,
  starterEntities,
  isGenerating,
  isReadyToGenerate,
  onUseTemplate,
  onCancel,
  onRefine,
}: TemplatePreviewProps) {
  const { colors } = useTheme();

  // Show draft preview if available
  if (draft) {
    return (
      <DraftPreview
        draft={draft}
        starterEntities={starterEntities}
        onAccept={onUseTemplate}
        onRefine={onRefine}
        onCancel={onCancel}
      />
    );
  }

  const blueprint = PROJECT_TYPE_BLUEPRINTS[projectType];
  const typeDef = PROJECT_TYPE_DEFS[projectType];
  let statusText = 'Answer a few questions to shape the blueprint.';

  if (isGenerating) {
    statusText = 'Generating your blueprint...';
  } else if (isReadyToGenerate) {
    statusText = 'Ready to generate. Review the draft when it appears.';
  } else if (phase === 'review') {
    statusText = 'Draft available. Refine if needed.';
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Feather name="zap" size={16} color={palette.purple[400]} />
          <Text style={[styles.title, { color: colors.text }]}>Blueprint Preview</Text>
        </View>
        <Text style={[styles.description, { color: colors.textMuted }]}>{typeDef.description}</Text>
      </View>

      {/* Status */}
      <View style={[styles.statusBox, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        <View style={styles.statusContent}>
          {isGenerating ? (
            <ActivityIndicator size="small" color={palette.purple[400]} />
          ) : (
            <Feather name="zap" size={14} color={palette.purple[400]} />
          )}
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>{statusText}</Text>
        </View>
      </View>

      {/* Blueprint sections */}
      <View style={styles.blueprintContainer}>
        <BlueprintSection title="Focus" items={blueprint.focus} />
        <BlueprintSection title="Entities" items={blueprint.entities} />
        <BlueprintSection title="Relationships" items={blueprint.relationships} />
        <BlueprintSection title="Documents" items={blueprint.documents} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: spacing[4],
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  title: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  description: {
    fontSize: typography.xs,
    lineHeight: typography.xs * typography.relaxed,
  },
  statusBox: {
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing[4],
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusText: {
    fontSize: typography.xs,
    flex: 1,
  },
  blueprintContainer: {
    gap: spacing[4],
  },
  blueprintSection: {
    gap: spacing[1],
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: typography.medium,
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1.5],
  },
  chip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radii.full,
  },
  chipText: {
    fontSize: 10,
  },
  // Draft preview styles
  draftContainer: {
    flex: 1,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  draftTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  draftSection: {
    marginBottom: spacing[4],
  },
  kindList: {
    gap: spacing[2],
  },
  kindItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
  },
  kindDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kindName: {
    fontSize: typography.sm,
  },
  starterList: {
    gap: spacing[2],
  },
  starterItem: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
  },
  starterName: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  starterKind: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  actions: {
    marginTop: spacing[4],
    gap: spacing[3],
  },
  primaryButton: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[4],
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
  },
  secondaryButtonText: {
    fontSize: typography.sm,
  },
});
