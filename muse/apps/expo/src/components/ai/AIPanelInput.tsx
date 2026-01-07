/**
 * AIPanelInput - Rich input bar with context chips, model selector, and context scope
 * Notion-inspired design with @ mentions and document references
 */

import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useRef, useCallback } from 'react';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { useAIStore, type ContextChip } from '@/stores/ai';
import { ModelSelector, ModelSelectorTrigger } from './ModelSelector';
import { ContextScope, ContextScopeTrigger } from './ContextScope';

interface AIPanelInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
}

export function AIPanelInput({ onSend, placeholder = 'Ask about your story...' }: AIPanelInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const {
    inputValue,
    setInputValue,
    contextChips,
    removeContextChip,
    showModelSelector,
    setShowModelSelector,
    showContextScope,
    setShowContextScope,
    isStreaming,
  } = useAIStore();

  const sendScale = useSharedValue(1);

  const handleSend = useCallback(() => {
    if (inputValue.trim() && !isStreaming) {
      onSend(inputValue.trim());
    }
  }, [inputValue, isStreaming, onSend]);

  const handleSendPressIn = () => {
    sendScale.value = withSpring(0.9);
  };

  const handleSendPressOut = () => {
    sendScale.value = withSpring(1);
  };

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const hasContent = inputValue.trim().length > 0;
  const canSend = hasContent && !isStreaming;

  return (
    <View style={styles.wrapper}>
      {/* Dropdowns (rendered above input) */}
      <ModelSelector
        visible={showModelSelector}
        onClose={() => setShowModelSelector(false)}
      />
      <ContextScope
        visible={showContextScope}
        onClose={() => setShowContextScope(false)}
      />

      {/* Main input container */}
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.bgElevated,
            borderColor: hasContent ? colors.accent : colors.border,
          },
        ]}
      >
        {/* Context chips row */}
        {contextChips.length > 0 && (
          <View style={styles.chipsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}
            >
              {contextChips.map((chip) => (
                <ContextChipView
                  key={chip.id}
                  chip={chip}
                  onRemove={() => removeContextChip(chip.id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input row */}
        <View style={styles.inputRow}>
          {/* @ mention button */}
          <Pressable
            style={({ pressed }) => [
              styles.mentionBtn,
              { backgroundColor: pressed ? colors.bgHover : 'transparent' },
            ]}
          >
            <Text style={[styles.mentionIcon, { color: colors.textMuted }]}>@</Text>
          </Pressable>

          {/* Text input */}
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={handleSend}
            multiline
            blurOnSubmit={Platform.OS === 'web'}
            maxLength={4000}
          />
        </View>

        {/* Controls row */}
        <View style={[styles.controlsRow, { borderTopColor: colors.borderSubtle }]}>
          {/* Left: Model selector & Context scope */}
          <View style={styles.controlsLeft}>
            <ModelSelectorTrigger />
            <ContextScopeTrigger />
          </View>

          {/* Right: Send button */}
          <Animated.View style={sendAnimatedStyle}>
            <Pressable
              style={[
                styles.sendBtn,
                {
                  backgroundColor: canSend ? colors.accent : colors.bgActive,
                },
              ]}
              onPress={handleSend}
              onPressIn={handleSendPressIn}
              onPressOut={handleSendPressOut}
              disabled={!canSend}
            >
              <Text
                style={[
                  styles.sendIcon,
                  { color: canSend ? '#fff' : colors.textMuted },
                ]}
              >
                ↑
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

interface ContextChipViewProps {
  chip: ContextChip;
  onRemove: () => void;
}

function ContextChipView({ chip, onRemove }: ContextChipViewProps) {
  const { colors } = useTheme();

  const iconMap: Record<ContextChip['type'], string> = {
    document: '📄',
    entity: '👤',
    mention: '@',
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.chip, { backgroundColor: colors.bgActive, borderColor: colors.border }]}
    >
      <Text style={styles.chipIcon}>{iconMap[chip.type]}</Text>
      <Text style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>
        {chip.label}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={[styles.chipRemove, { color: colors.textMuted }]}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  chipsRow: {
    paddingTop: spacing[2],
    paddingHorizontal: spacing[2],
  },
  chipsContent: {
    flexDirection: 'row',
    gap: spacing[1.5],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[1],
  },
  chipIcon: {
    fontSize: typography.xs,
  },
  chipLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    maxWidth: 100,
  },
  chipRemove: {
    fontSize: typography.sm,
    marginLeft: spacing[0.5],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  mentionBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[1],
  },
  mentionIcon: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  input: {
    flex: 1,
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.normal,
    minHeight: 24,
    maxHeight: 120,
    paddingTop: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    fontSize: typography.base,
    fontWeight: typography.bold,
  },
});
