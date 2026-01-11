/**
 * TemplateBuilderInput - Chat input for AI Template Builder
 */

import { useState, useCallback, useRef } from 'react';
import { View, TextInput, Pressable, StyleSheet, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii, palette } from '@/design-system';

interface TemplateBuilderInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput | null>;
}

export function TemplateBuilderInput({
  onSend,
  isStreaming,
  placeholder,
  inputRef,
}: TemplateBuilderInputProps) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const localRef = useRef<TextInput>(null);
  const resolvedRef = inputRef ?? localRef;

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
  }, [input, isStreaming, onSend]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      // On web, Enter without Shift sends the message
      // shiftKey only exists on web - cast to access it
      const nativeEvent = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
      if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
        (e as { preventDefault?: () => void }).preventDefault?.();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = input.trim().length > 0 && !isStreaming;

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={resolvedRef}
          value={input}
          onChangeText={setInput}
          onKeyPress={handleKeyPress}
          placeholder={placeholder ?? 'Describe your project idea...'}
          placeholderTextColor={colors.textGhost}
          editable={!isStreaming}
          multiline
          numberOfLines={2}
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.border,
              color: colors.text,
              opacity: isStreaming ? 0.5 : 1,
            },
          ]}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendButton,
            {
              backgroundColor: canSend
                ? pressed
                  ? palette.purple[500]
                  : palette.purple[400]
                : colors.bgSurface,
              opacity: canSend ? 1 : 0.5,
            },
          ]}
        >
          <Feather name="arrow-up" size={16} color={canSend ? '#fff' : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    fontSize: typography.sm,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
