/**
 * AskQuestionCard - Inline question UI for AI-driven clarifications
 * Supports 0-N options, multi-select, and freeform input
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';

interface QuestionOption {
  label: string;
  value: string;
}

interface AskQuestionCardProps {
  id: string;
  question: string;
  options?: QuestionOption[];
  context?: string;
  multiSelect?: boolean;
  allowFreeform?: boolean;
  onAnswer: (id: string, answer: string | string[]) => void;
  onDismiss?: (id: string) => void;
}

// @ts-expect-error Reanimated 4 types don't work well with Pressable
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AskQuestionCard({
  id,
  question,
  options,
  context,
  multiSelect = false,
  allowFreeform = false,
  onAnswer,
  onDismiss,
}: AskQuestionCardProps) {
  const { colors, isDark } = useTheme();
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [freeformText, setFreeformText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const hasOptions = options && options.length > 0;
  const showFreeform = !hasOptions || allowFreeform;

  const handleOptionPress = useCallback((value: string) => {
    if (multiSelect) {
      setSelectedValues(prev =>
        prev.includes(value)
          ? prev.filter(v => v !== value)
          : [...prev, value]
      );
    } else {
      onAnswer(id, value);
    }
  }, [id, multiSelect, onAnswer]);

  const handleSubmit = useCallback(() => {
    if (multiSelect && selectedValues.length > 0) {
      onAnswer(id, selectedValues);
    } else if (freeformText.trim()) {
      onAnswer(id, freeformText.trim());
    }
  }, [id, multiSelect, selectedValues, freeformText, onAnswer]);

  const handleDismiss = useCallback(() => {
    onDismiss?.(id);
  }, [id, onDismiss]);

  const canSubmit = multiSelect
    ? selectedValues.length > 0
    : freeformText.trim().length > 0;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? palette.gray[850] : palette.gray[50],
          borderColor: isDark ? palette.gray[700] : palette.gray[200],
        },
      ]}
    >
      {/* Question header */}
      <View style={styles.header}>
        <View style={styles.questionMark}>
          <Text style={[styles.questionMarkText, { color: colors.accent }]}>?</Text>
        </View>
        <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
        {onDismiss && (
          <Pressable
            onPress={handleDismiss}
            style={({ pressed }) => [
              styles.dismissButton,
              { opacity: pressed ? 0.5 : 0.6 },
            ]}
            hitSlop={8}
          >
            <Text style={[styles.dismissIcon, { color: colors.textMuted }]}>x</Text>
          </Pressable>
        )}
      </View>

      {/* Context hint */}
      {context && (
        <View style={[styles.contextContainer, { borderColor: colors.borderSubtle }]}>
          <Text style={[styles.contextText, { color: colors.textMuted }]}>
            {context}
          </Text>
        </View>
      )}

      {/* Options */}
      {hasOptions && (
        <View style={styles.optionsContainer}>
          {options.map((option) => (
            <OptionButton
              key={option.value}
              label={option.label}
              selected={selectedValues.includes(option.value)}
              multiSelect={multiSelect}
              onPress={() => handleOptionPress(option.value)}
            />
          ))}
        </View>
      )}

      {/* Freeform input */}
      {showFreeform && (
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.bgApp,
              borderColor: isFocused ? colors.accent : colors.border,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Type your answer..."
            placeholderTextColor={colors.textMuted}
            value={freeformText}
            onChangeText={setFreeformText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            multiline
            maxLength={500}
          />
        </View>
      )}

      {/* Submit button for multi-select or freeform */}
      {(multiSelect || showFreeform) && (
        <View style={styles.footer}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: canSubmit
                  ? pressed
                    ? colors.accentHover
                    : colors.accent
                  : colors.bgHover,
              },
            ]}
          >
            <Text
              style={[
                styles.submitText,
                { color: canSubmit ? palette.white : colors.textMuted },
              ]}
            >
              {multiSelect ? `Select (${selectedValues.length})` : 'Submit'}
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  multiSelect: boolean;
  onPress: () => void;
}

function OptionButton({ label, selected, multiSelect, onPress }: OptionButtonProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);
  const progress = useSharedValue(selected ? 1 : 0);

  progress.value = withTiming(selected ? 1 : 0, { duration: 150 });

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [
        isDark ? palette.gray[800] : palette.gray[100],
        isDark ? palette.blue[600] + '30' : palette.blue[500] + '15',
      ]
    );
    const borderColor = interpolateColor(
      progress.value,
      [0, 1],
      [
        isDark ? palette.gray[700] : palette.gray[200],
        isDark ? palette.blue[400] : palette.blue[500],
      ]
    );
    return {
      backgroundColor,
      borderColor,
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.optionButton, animatedStyle]}
    >
      {multiSelect && (
        <View
          style={[
            styles.checkbox,
            {
              borderColor: selected ? colors.accent : colors.textMuted,
              backgroundColor: selected ? colors.accent : 'transparent',
            },
          ]}
        >
          {selected && <Text style={styles.checkmark}>{'check'}</Text>}
        </View>
      )}
      <Text
        style={[
          styles.optionLabel,
          { color: selected ? colors.accent : colors.text },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },
  questionMark: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  questionMarkText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  question: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    lineHeight: typography.sm * 1.4,
  },
  dismissButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
    marginRight: -4,
  },
  dismissIcon: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  contextContainer: {
    marginHorizontal: spacing[3],
    marginBottom: spacing[2],
    paddingLeft: spacing[2],
    borderLeftWidth: 2,
  },
  contextText: {
    fontSize: typography.xs,
    fontStyle: 'italic',
  },
  optionsContainer: {
    padding: spacing[3],
    paddingTop: spacing[1],
    gap: spacing[2],
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[2],
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 10,
    color: palette.white,
    fontWeight: typography.bold,
  },
  optionLabel: {
    flex: 1,
    fontSize: typography.sm,
  },
  inputContainer: {
    marginHorizontal: spacing[3],
    marginBottom: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 72,
  },
  input: {
    flex: 1,
    padding: spacing[3],
    fontSize: typography.sm,
    lineHeight: typography.sm * 1.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing[3],
    paddingTop: spacing[1],
  },
  submitButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
  },
  submitText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
});
