/**
 * WelcomeState - Empty chat state with Muse avatar and quick actions
 * Shown when no messages exist in the current thread
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useTheme, spacing, typography } from '@/design-system';
import { MuseAvatar } from './MuseAvatar';
import { QuickActions } from './QuickActions';
import { type QuickAction } from '@mythos/state';

interface WelcomeStateProps {
  onAction: (action: QuickAction) => void;
}

export function WelcomeState({ onAction }: WelcomeStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.avatarContainer}>
        <MuseAvatar size="welcome" animated />
      </Animated.View>

      {/* Greeting */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.greeting}>
        <Text style={[styles.greetingTitle, { color: colors.text }]}>
          What can I help with?
        </Text>
        <Text style={[styles.greetingSubtitle, { color: colors.textSecondary }]}>
          Ask about your story, characters, or world
        </Text>
      </Animated.View>

      {/* Quick actions */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.actions}>
        <QuickActions onAction={onAction} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  greeting: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  greetingTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    marginBottom: spacing[1],
  },
  greetingSubtitle: {
    fontSize: typography.sm,
    textAlign: 'center',
  },
  actions: {
    flex: 1,
  },
});
