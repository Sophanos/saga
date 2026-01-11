/**
 * PhaseIndicator - Shows current phase in template generation
 */

import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, palette } from '@/design-system';
import { PROJECT_TYPE_DEFS, type ProjectType, type TemplateBuilderPhase } from '@mythos/core';

interface PhaseIndicatorProps {
  phase: TemplateBuilderPhase;
  projectType: ProjectType;
}

interface PhaseStep {
  id: TemplateBuilderPhase;
  label: string;
  description: string;
}

const PHASES: PhaseStep[] = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'Capture goals and constraints',
  },
  {
    id: 'generate',
    label: 'Generate',
    description: 'Shape the blueprint',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Inspect and refine',
  },
  {
    id: 'done',
    label: 'Ready',
    description: 'Template confirmed',
  },
];

export function PhaseIndicator({ phase, projectType }: PhaseIndicatorProps) {
  const { colors } = useTheme();
  const currentIndex = PHASES.findIndex((step) => step.id === phase);
  const activeLabel = PHASES[currentIndex]?.label ?? 'Discovery';
  const typeLabel = PROJECT_TYPE_DEFS[projectType].label;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.label, { color: colors.textMuted }]}>BLUEPRINT</Text>
          <Text style={[styles.typeLabel, { color: colors.text }]}>{typeLabel}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.badgeText, { color: colors.textMuted }]}>{activeLabel}</Text>
        </View>
      </View>

      {/* Steps */}
      <View style={styles.steps}>
        {PHASES.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <View key={step.id} style={styles.step}>
              <View style={styles.stepIcon}>
                {isComplete ? (
                  <Feather name="check-circle" size={14} color={palette.green[400]} />
                ) : (
                  <Feather
                    name="circle"
                    size={14}
                    color={isActive ? palette.purple[400] : colors.textMuted}
                  />
                )}
              </View>
              <View style={styles.stepContent}>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: isActive ? colors.text : colors.textSecondary,
                      fontWeight: isActive ? typography.medium : typography.regular,
                    },
                  ]}
                >
                  {step.label}
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
                  {step.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 10,
    fontWeight: typography.medium,
    letterSpacing: 0.5,
  },
  typeLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: 9999,
  },
  badgeText: {
    fontSize: 10,
  },
  steps: {
    gap: spacing[2],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  stepIcon: {
    marginTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: typography.xs,
  },
  stepDescription: {
    fontSize: 10,
  },
});
