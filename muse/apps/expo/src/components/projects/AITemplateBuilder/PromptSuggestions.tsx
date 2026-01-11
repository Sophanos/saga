/**
 * PromptSuggestions - Initial suggestions for AI Template Builder
 */

import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii, palette } from '@/design-system';
import {
  DOMAIN_QUESTIONS,
  DOMAIN_SUGGESTIONS,
  PROJECT_TYPE_DEFS,
  type ProjectType,
} from '@mythos/core';

interface PromptSuggestionsProps {
  projectType: ProjectType;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptSuggestions({
  projectType,
  onSelect,
  disabled,
}: PromptSuggestionsProps) {
  const { colors } = useTheme();
  const typeDef = PROJECT_TYPE_DEFS[projectType];
  const suggestions = DOMAIN_SUGGESTIONS[projectType];
  const questions = DOMAIN_QUESTIONS[projectType];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${palette.purple[400]}20` }]}>
          <Feather name="zap" size={24} color={palette.purple[400]} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Describe your {typeDef.label.toLowerCase()}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Share your idea and I'll build a domain-specific blueprint with entities,
          relationships, and structure.
        </Text>
      </View>

      {/* Suggestions */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          TRY ONE OF THESE
        </Text>
        <View style={styles.suggestionList}>
          {suggestions.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => onSelect(s.prompt)}
              disabled={disabled}
              style={({ pressed, hovered }) => [
                styles.suggestionButton,
                {
                  backgroundColor: pressed || hovered ? `${palette.purple[400]}10` : colors.bgSurface,
                  borderColor: pressed || hovered ? `${palette.purple[400]}30` : 'transparent',
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Questions preview */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          WE WILL ASK ABOUT
        </Text>
        <View style={styles.questionChips}>
          {questions.slice(0, 4).map((q) => (
            <View
              key={q.id}
              style={[styles.questionChip, { backgroundColor: colors.bgSurface }]}
            >
              <Text style={[styles.questionChipText, { color: colors.textMuted }]} numberOfLines={1}>
                {q.question}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: typography.xs,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: typography.xs * typography.relaxed,
  },
  section: {
    width: '100%',
    marginBottom: spacing[4],
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: typography.medium,
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  suggestionList: {
    gap: spacing[2],
  },
  suggestionButton: {
    width: '100%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: typography.sm,
  },
  questionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1.5],
  },
  questionChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radii.full,
    maxWidth: '100%',
  },
  questionChipText: {
    fontSize: 10,
  },
});
