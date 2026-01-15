/**
 * AIPanelInput - Rich input bar with context chips, model selector, and context scope
 * Craft-inspired floating chat bar with auto-expanding textarea
 */

import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { useAIStore, type ContextChip } from '@mythos/state';
import { ModelSelector, ModelSelectorTrigger } from './ModelSelector';
import { ContextScope, ContextScopeTrigger } from './ContextScope';
import { Feather } from '@expo/vector-icons';

interface AIPanelInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  documentTitle?: string;
  hideGradient?: boolean;
}

export function AIPanelInput({ onSend, placeholder = 'Ask about your story...', documentTitle, hideGradient = false }: AIPanelInputProps) {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [inputHeight, setInputHeight] = useState(24);
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
      setInputValue(''); // Clear after sending
      setInputHeight(24); // Reset height
    }
  }, [inputValue, isStreaming, onSend, setInputValue]);

  const handleSendPressIn = () => {
    sendScale.value = withSpring(0.9);
  };

  const handleSendPressOut = () => {
    sendScale.value = withSpring(1);
  };

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  // Auto-resize input based on content
  const handleContentSizeChange = useCallback((e: { nativeEvent: { contentSize: { height: number } } }) => {
    const newHeight = Math.min(Math.max(e.nativeEvent.contentSize.height, 24), 200);
    setInputHeight(newHeight);
  }, []);

  // Reset height when input is cleared
  useEffect(() => {
    if (!inputValue) {
      setInputHeight(24);
    }
  }, [inputValue]);

  const hasContent = inputValue.trim().length > 0;
  const canSend = hasContent && !isStreaming;

  return (
    <View style={styles.wrapper}>
      {/* Gradient fade above chat bar */}
      {!hideGradient && (
        <LinearGradient
          colors={['transparent', colors.sidebarBg]}
          style={styles.fadeGradient}
          pointerEvents="none"
        />
      )}

      {/* Dropdowns (rendered above input) */}
      <ModelSelector
        visible={showModelSelector}
        onClose={() => setShowModelSelector(false)}
      />
      <ContextScope
        visible={showContextScope}
        onClose={() => setShowContextScope(false)}
      />

      {/* Floating pill container */}
      <View style={styles.floatingContainer}>
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

        {/* Main input container - pill shape */}
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.bgElevated,
              borderColor: hasContent ? colors.accent : 'transparent',
              shadowColor: isDark ? '#000' : '#666',
            },
          ]}
        >
          {/* Text input area - auto-expands */}
          <View style={styles.inputArea}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { color: colors.text, height: inputHeight, outlineStyle: 'none' } as any,
              ]}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={handleSend}
              onContentSizeChange={handleContentSizeChange}
              multiline
              blurOnSubmit={Platform.OS === 'web'}
              maxLength={4000}
            />
          </View>

          {/* Controls row - Craft style */}
          <View style={styles.controlsRow}>
            {/* Left: Action chips */}
            <View style={styles.controlsLeft}>
              {/* Add button - subtle bg */}
              <Pressable
                style={[styles.actionChip, { backgroundColor: colors.bgHover }]}
              >
                <Text style={[styles.actionChipIcon, { color: colors.textMuted }]}>+</Text>
              </Pressable>

              {/* Mode chip - subtle bg */}
              <Pressable
                style={[styles.actionChip, styles.modeChip, { backgroundColor: colors.bgHover }]}
                onPress={() => setShowModelSelector(true)}
              >
                <Text style={[styles.modeIcon, { color: colors.accent }]}>⚡</Text>
                <Text style={[styles.modeText, { color: colors.textMuted }]}>Fast</Text>
              </Pressable>

              {/* Context scope chip */}
              {documentTitle ? (
                <Pressable
                  style={[styles.actionChip, styles.contextChip, { backgroundColor: colors.bgHover }]}
                  onPress={() => setShowContextScope(true)}
                >
                  <Text style={[styles.contextIcon, { color: colors.textMuted }]}>◇</Text>
                  <Text
                    style={[styles.contextText, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {documentTitle}
                  </Text>
                </Pressable>
              ) : (
                <ContextScopeTrigger />
              )}
            </View>

            {/* Right: Send button */}
            <Animated.View style={sendAnimatedStyle}>
              <Pressable
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: canSend ? colors.accent : (colors.bgHover),
                  },
                ]}
                onPress={handleSend}
                onPressIn={handleSendPressIn}
                onPressOut={handleSendPressOut}
                disabled={!canSend}
              >
                <Feather
                  name="arrow-up"
                  size={16}
                  color={canSend ? (isDark ? '#1a1a1a' : '#fff') : colors.textMuted}
                />
              </Pressable>
            </Animated.View>
          </View>
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
    zIndex: 100,
    overflow: 'visible',
  },
  fadeGradient: {
    position: 'absolute',
    top: -48,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 1,
  },
  floatingContainer: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[2],
  },
  container: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  chipsRow: {
    paddingBottom: spacing[1.5],
    paddingHorizontal: spacing[1],
  },
  chipsContent: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[1],
  },
  chipIcon: {
    fontSize: 10,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: typography.medium,
    maxWidth: 80,
  },
  chipRemove: {
    fontSize: 12,
    marginLeft: spacing[0.5],
  },
  inputArea: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2.5],
    paddingBottom: spacing[1.5],
  },
  input: {
    fontSize: typography.sm,
    lineHeight: typography.sm * 1.4,
    minHeight: 20,
    maxHeight: 200,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[2],
    gap: spacing[1.5],
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    flex: 1,
  },
  actionChip: {
    height: 28,
    minWidth: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipIcon: {
    fontSize: 16,
  },
  modeChip: {
    flexDirection: 'row',
    paddingHorizontal: spacing[2.5],
    gap: spacing[1],
  },
  modeIcon: {
    fontSize: 12,
  },
  modeText: {
    fontSize: 11,
  },
  contextChip: {
    flexDirection: 'row',
    paddingHorizontal: spacing[2.5],
    gap: spacing[1],
    maxWidth: 140,
  },
  contextIcon: {
    fontSize: 12,
  },
  contextText: {
    fontSize: 11,
    flexShrink: 1,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
