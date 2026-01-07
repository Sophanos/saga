/**
 * QuickActions - Writer-focused AI quick actions
 * Displayed in welcome state and as suggestions
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { QUICK_ACTIONS, type QuickAction } from '@/stores/ai';

interface QuickActionsProps {
  onAction: (action: QuickAction) => void;
  compact?: boolean;
}

export function QuickActions({ onAction, compact = false }: QuickActionsProps) {
  const actions = Object.entries(QUICK_ACTIONS) as [QuickAction, typeof QUICK_ACTIONS[QuickAction]][];

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {actions.slice(0, 4).map(([key, action], index) => (
          <QuickActionChip
            key={key}
            action={key}
            label={action.label}
            icon={action.icon}
            onPress={() => onAction(key)}
            delay={index * 50}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {actions.map(([key, action], index) => (
        <QuickActionCard
          key={key}
          action={key}
          label={action.label}
          description={action.description}
          icon={action.icon}
          badge={action.badge}
          onPress={() => onAction(key)}
          delay={index * 75}
        />
      ))}
    </View>
  );
}

interface QuickActionCardProps {
  action: QuickAction;
  label: string;
  description: string;
  icon: string;
  badge?: string;
  onPress: () => void;
  delay?: number;
}

function QuickActionCard({
  action,
  label,
  description,
  icon,
  badge,
  onPress,
  delay = 0,
}: QuickActionCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const iconMap: Record<QuickAction, string> = {
    search: '🔍',
    lint: '⚠️',
    continue: '✍️',
    character: '👤',
    brainstorm: '💡',
    arc: '📈',
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      style={animatedStyle}
    >
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: pressed ? colors.bgActive : colors.bgElevated,
            borderColor: colors.border,
          },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.cardIcon}>
          <Text style={styles.cardIconText}>{iconMap[action]}</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardLabel, { color: colors.text }]}>
              {label}
            </Text>
            {badge && (
              <View style={[styles.cardBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.cardBadgeText}>{badge}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.cardDescription, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {description}
          </Text>
        </View>
        <Text style={[styles.cardArrow, { color: colors.textMuted }]}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

interface QuickActionChipProps {
  action: QuickAction;
  label: string;
  icon: string;
  onPress: () => void;
  delay?: number;
}

function QuickActionChip({ action, label, icon, onPress, delay = 0 }: QuickActionChipProps) {
  const { colors } = useTheme();

  const iconMap: Record<QuickAction, string> = {
    search: '🔍',
    lint: '⚠️',
    continue: '✍️',
    character: '👤',
    brainstorm: '💡',
    arc: '📈',
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: pressed ? colors.bgActive : colors.bgElevated,
            borderColor: colors.border,
          },
        ]}
        onPress={onPress}
      >
        <Text style={styles.chipIcon}>{iconMap[action]}</Text>
        <Text style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>
          {label.split(' ')[0]}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  compactContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  // Card styles
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing[3],
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: {
    fontSize: 18,
  },
  cardContent: {
    flex: 1,
    gap: spacing[0.5],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  cardLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  cardBadge: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
    borderRadius: radii.sm,
  },
  cardBadgeText: {
    color: '#fff',
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  cardDescription: {
    fontSize: typography.xs,
  },
  cardArrow: {
    fontSize: typography.xl,
    fontWeight: typography.regular,
  },
  // Chip styles
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[1.5],
  },
  chipIcon: {
    fontSize: typography.sm,
  },
  chipLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
});
