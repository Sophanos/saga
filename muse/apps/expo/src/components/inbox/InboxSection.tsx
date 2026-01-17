/**
 * InboxSection - Collapsible section with header (Expo/RN)
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography } from '@/design-system';

interface InboxSectionAction {
  label: string;
  onPress: () => void;
}

interface InboxSectionProps {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  action?: InboxSectionAction;
  children: React.ReactNode;
}

export function InboxSection({
  title,
  count,
  defaultExpanded = true,
  collapsible = true,
  action,
  children,
}: InboxSectionProps) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Don't render if no children
  if (!children) return null;

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Pressable
        onPress={handleToggle}
        disabled={!collapsible}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          {/* Collapse indicator */}
          {collapsible && (
            <Feather
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={12}
              color={colors.textGhost}
            />
          )}

          {/* Section title */}
          <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>

          {/* Count badge */}
          {count !== undefined && count > 0 && (
            <Text style={[styles.count, { color: colors.textGhost }]}>{count}</Text>
          )}
        </View>

        {/* Section action */}
        {action && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              action.onPress();
            }}
          >
            <Text style={[styles.actionText, { color: colors.textMuted }]}>
              {action.label}
            </Text>
          </Pressable>
        )}
      </Pressable>

      {/* Section content */}
      {isExpanded && (
        <Animated.View entering={FadeIn.duration(150)}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Controlled version with external state
 */
interface ControlledInboxSectionProps extends Omit<InboxSectionProps, 'defaultExpanded'> {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ControlledInboxSection({
  title,
  count,
  isExpanded,
  onToggle,
  collapsible = true,
  action,
  children,
}: ControlledInboxSectionProps) {
  const { colors } = useTheme();

  if (!children) return null;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          {collapsible && (
            <Feather
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={12}
              color={colors.textGhost}
            />
          )}
          <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
          {count !== undefined && count > 0 && (
            <Text style={[styles.count, { color: colors.textGhost }]}>{count}</Text>
          )}
        </View>

        {action && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              action.onPress();
            }}
          >
            <Text style={[styles.actionText, { color: colors.textMuted }]}>
              {action.label}
            </Text>
          </Pressable>
        )}
      </Pressable>

      {isExpanded && (
        <Animated.View entering={FadeIn.duration(150)}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[1],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionText: {
    fontSize: typography.xs,
  },
});
