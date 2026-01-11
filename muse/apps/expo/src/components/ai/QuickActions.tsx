/**
 * QuickActions - Notion-style AI quick actions
 * Clean list with icon + label
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { QUICK_ACTIONS, type QuickAction } from '@mythos/state';

interface QuickActionsProps {
  onAction: (action: QuickAction) => void;
}

const ICONS: Record<QuickAction, string> = {
  search: '🔍',
  review: '⚠️',
  draft_next: '✍️',
  create_entity: '👤',
  brainstorm: '💡',
  analyze_structure: '📈',
  clarity_check: '✨',
  policy_check: '🛡️',
};

export function QuickActions({ onAction }: QuickActionsProps) {
  const { colors } = useTheme();
  const actions = Object.entries(QUICK_ACTIONS) as [QuickAction, typeof QUICK_ACTIONS[QuickAction]][];

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {actions.map(([key, action]) => (
        <Pressable
          key={key}
          style={({ pressed, hovered }) => [
            styles.item,
            (pressed || hovered) && { backgroundColor: colors.bgHover },
          ]}
          onPress={() => onAction(key)}
        >
          <Text style={styles.icon}>{ICONS[key]}</Text>
          <Text style={[styles.label, { color: colors.text }]}>{action.label}</Text>
          {action.badge && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>{action.badge}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[0.5],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[2],
    borderRadius: radii.md,
    gap: spacing[3],
  },
  icon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  label: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radii.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
});
