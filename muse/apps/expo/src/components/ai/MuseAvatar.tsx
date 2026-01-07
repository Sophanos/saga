/**
 * MuseAvatar - The AI persona avatar
 * A distinctive, literary-inspired icon representing the Muse
 */

import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme, sizing, radii } from '@/design-system';

type AvatarSize = 'fab' | 'message' | 'welcome';

interface MuseAvatarProps {
  size?: AvatarSize;
  animated?: boolean;
  thinking?: boolean;
}

const sizeMap: Record<AvatarSize, number> = {
  fab: sizing.aiAvatarFab,
  message: sizing.aiAvatarMessage,
  welcome: sizing.aiAvatarWelcome,
};

export function MuseAvatar({ size = 'message', animated = false, thinking = false }: MuseAvatarProps) {
  const { colors, isDark } = useTheme();
  const dimension = sizeMap[size];
  const iconSize = dimension * 0.55;

  // Subtle breathing animation for thinking state
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (thinking) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      scale.value = withSpring(1);
    }
  }, [thinking, scale]);

  useEffect(() => {
    if (animated) {
      rotation.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 2000 }),
          withTiming(-3, { duration: 2000 })
        ),
        -1,
        true
      );
    }
  }, [animated, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const bgColor = isDark ? colors.bgElevated : colors.bgSurface;
  const strokeColor = colors.text;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          backgroundColor: bgColor,
          borderColor: colors.border,
        },
        animated && animatedStyle,
      ]}
    >
      <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        {/* Abstract face - inspired by Notion AI but unique */}
        {/* Brow/thinking line */}
        <Path
          d="M7 8.5C8.5 7 11 6.5 12 6.5C13 6.5 15.5 7 17 8.5"
          stroke={strokeColor}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        {/* Left eye - contemplative */}
        <Circle cx="9" cy="12" r="1.5" fill={strokeColor} />
        {/* Right eye - slightly different for asymmetry */}
        <Path
          d="M14 11C14 11 15 10.5 16 11.5"
          stroke={strokeColor}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        {/* Subtle mouth/chin suggestion */}
        <Path
          d="M10 17C11 18 13 18 14 17"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
