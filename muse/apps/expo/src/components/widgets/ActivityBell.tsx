import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '@/design-system';
import { palette } from '@/design-system/colors';
import {
  useActivityStore,
  useActivityOpen,
  useNeedsAttentionCount,
  useHasRunningWidgets,
} from '@mythos/state';
import { ActivityInbox } from './ActivityInbox';

interface ActivityBellProps {
  rightOffset?: number;
}

export function ActivityBell({ rightOffset = spacing[4] }: ActivityBellProps) {
  const { colors, isDark } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const isOpen = useActivityOpen();
  const toggle = useActivityStore((s) => s.toggle);
  const close = useActivityStore((s) => s.close);
  const needsAttentionCount = useNeedsAttentionCount();
  const hasRunning = useHasRunningWidgets();

  const showBadge = needsAttentionCount > 0;
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
        accessibilityLabel={`Activity${needsAttentionCount > 0 ? ` (${needsAttentionCount} items need attention)` : ''}`}
      >
        <Animated.View style={showPulse ? pulseStyle : undefined}>
          <Feather name="bell" size={16} color={iconColor} />
        </Animated.View>

        {showBadge && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={styles.badgeText}>
              {needsAttentionCount > 9 ? '9+' : needsAttentionCount}
            </Text>
          </View>
        )}

        {showPulse && (
          <Animated.View
            style={[
              styles.runningDot,
              { backgroundColor: colors.accent },
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
          <ActivityInbox />
        </View>
      </Modal>
    </>
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
});
