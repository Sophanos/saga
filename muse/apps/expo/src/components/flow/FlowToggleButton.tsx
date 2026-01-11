/**
 * FlowToggleButton - Button to enter flow mode (Expo)
 *
 * A zen-like button that invites users into distraction-free writing.
 */

import { Pressable, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { useFlowStore } from '@mythos/state';

interface FlowToggleButtonProps {
  /** Current word count to pass to flow session */
  wordCount?: number;
  /** Show label text (default: true on larger screens) */
  showLabel?: boolean;
}

export function FlowToggleButton({ wordCount = 0, showLabel = true }: FlowToggleButtonProps) {
  const { colors, isDark } = useTheme();
  const enterFlowMode = useFlowStore((s) => s.enterFlowMode);

  const handlePress = () => {
    enterFlowMode(wordCount);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed, hovered }) => [
        styles.button,
        {
          backgroundColor: hovered || pressed
            ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
            : 'transparent',
        },
      ]}
      accessibilityLabel="Enter Flow Mode"
      accessibilityHint="Opens distraction-free writing mode"
    >
      <Feather name="target" size={16} color={colors.textSecondary} />
      {showLabel && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>Flow</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    borderRadius: radii.sm,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
});
