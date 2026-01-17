/**
 * InboxBell - Bell icon trigger for the Inbox panel (Expo/RN)
 */

import { useEffect, useState } from 'react';
import { View, Pressable, Text, Modal, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '@/design-system';
import { palette } from '@/design-system/colors';
import {
  useInboxStore,
  useInboxOpen,
  useTotalInboxCount,
  useHasRunningActivity,
} from '@mythos/state';
import { Inbox } from './Inbox';

interface InboxBellProps {
  rightOffset?: number;
  onNavigateToDocument?: (documentId: string) => void;
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToArtifact?: (artifactId: string) => void;
}

export function InboxBell({
  rightOffset = spacing[4],
  onNavigateToDocument,
  onNavigateToEntity,
  onNavigateToArtifact,
}: InboxBellProps) {
  const { colors, isDark } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const isOpen = useInboxOpen();
  const toggle = useInboxStore((s) => s.toggle);
  const close = useInboxStore((s) => s.close);
  const totalCount = useTotalInboxCount();
  const hasRunning = useHasRunningActivity();

  const showBadge = totalCount > 0;
  const showPulse = hasRunning && !showBadge;

  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (showPulse) {
      pulseOpacity.value = withRepeat(
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [showPulse, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const iconColor = showBadge
    ? colors.accent
    : isDark
      ? palette.gray[400]
      : palette.gray[500];

  const bgColor = isOpen
    ? isDark ? palette.gray[700] : palette.gray[200]
    : isHovered
      ? isDark ? palette.gray[750] : palette.gray[100]
      : 'transparent';

  return (
    <>
      <Pressable
        onPress={toggle}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={[styles.button, { backgroundColor: bgColor }]}
        accessibilityLabel={`Inbox${totalCount > 0 ? ` (${totalCount} items)` : ''}`}
        accessibilityRole="button"
      >
        <Animated.View style={showPulse ? pulseStyle : undefined}>
          <Feather name="bell" size={16} color={iconColor} />
        </Animated.View>

        {/* Badge */}
        {showBadge && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={styles.badgeText}>
              {totalCount > 9 ? '9+' : totalCount}
            </Text>
          </View>
        )}

        {/* Running indicator dot */}
        {showPulse && (
          <Animated.View
            style={[
              styles.runningDot,
              { backgroundColor: palette.amber[400] },
              pulseStyle,
            ]}
          />
        )}
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.inboxContainer, { right: rightOffset }]}>
          <Inbox
            onClose={close}
            onNavigateToDocument={(docId) => {
              onNavigateToDocument?.(docId);
              close();
            }}
            onNavigateToEntity={(entityId) => {
              onNavigateToEntity?.(entityId);
              close();
            }}
            onNavigateToArtifact={(artifactId) => {
              onNavigateToArtifact?.(artifactId);
              close();
            }}
          />
        </View>
      </Modal>
    </>
  );
}

/**
 * Minimal variant for compact headers
 */
interface InboxBellMinimalProps {
  count?: number;
  isRunning?: boolean;
  onPress?: () => void;
}

export function InboxBellMinimal({
  count = 0,
  isRunning = false,
  onPress,
}: InboxBellMinimalProps) {
  const { colors, isDark } = useTheme();

  const showBadge = count > 0;
  const showPulse = isRunning && !showBadge;

  const iconColor = showBadge
    ? colors.accent
    : isDark
      ? palette.gray[400]
      : palette.gray[500];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonMinimal,
        { backgroundColor: pressed ? (isDark ? palette.gray[750] : palette.gray[100]) : 'transparent' },
      ]}
      accessibilityLabel={`Inbox${count > 0 ? ` (${count} items)` : ''}`}
    >
      <Feather name="bell" size={14} color={iconColor} />

      {showBadge && (
        <View style={[styles.badgeMinimal, { backgroundColor: colors.accent }]}>
          <Text style={styles.badgeTextMinimal}>
            {count > 9 ? '9+' : count}
          </Text>
        </View>
      )}

      {showPulse && (
        <View style={[styles.runningDotMinimal, { backgroundColor: palette.amber[400] }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 12,
  },
  runningDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  inboxContainer: {
    position: 'absolute',
    top: 55,
    zIndex: 100,
  },
  buttonMinimal: {
    position: 'relative',
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMinimal: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 2,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTextMinimal: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 10,
  },
  runningDotMinimal: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
