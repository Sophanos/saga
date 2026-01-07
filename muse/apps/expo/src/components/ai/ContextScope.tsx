import { View, Text, Pressable, Switch, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, spacing, radii, typography, shadows } from '@/design-system';
import { useAIStore, CONTEXT_SCOPES, type ContextScope as ContextScopeType } from '@/stores/ai';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ContextScopeProps {
  visible: boolean;
  onClose: () => void;
}

export function ContextScope({ visible, onClose }: ContextScopeProps) {
  const { colors } = useTheme();
  const { enabledScopes, toggleScope, webSearchEnabled, setWebSearchEnabled } = useAIStore();

  if (!visible) return null;

  const scopes = Object.entries(CONTEXT_SCOPES) as [ContextScopeType, typeof CONTEXT_SCOPES[ContextScopeType]][];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={[
          styles.container,
          shadows.lg,
          { backgroundColor: colors.bgElevated, borderColor: colors.border },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerText, { color: colors.textSecondary }]}>
            Include in context
          </Text>
        </View>

        <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowIcon}>🌐</Text>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Web Search</Text>
          </View>
          <Switch
            value={webSearchEnabled}
            onValueChange={setWebSearchEnabled}
            trackColor={{ false: colors.bgActive, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>

        {scopes.map(([key, scope]) => {
          const isEnabled = enabledScopes.includes(key);
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.item,
                { backgroundColor: pressed ? colors.bgHover : 'transparent' },
              ]}
              onPress={() => toggleScope(key)}
            >
              <View style={styles.rowInfo}>
                <Text style={[styles.rowIcon, { opacity: isEnabled ? 1 : 0.5 }]}>
                  {SCOPE_ICONS[key]}
                </Text>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{scope.label}</Text>
              </View>
              {isEnabled && <Text style={[styles.check, { color: colors.accent }]}>✓</Text>}
            </Pressable>
          );
        })}

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            AI searches only selected sources
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const SCOPE_ICONS: Record<ContextScopeType, string> = {
  scene: '📄',
  chapter: '📖',
  project: '📚',
  entities: '👥',
  world: '🗺️',
  notes: '📝',
};

export function ContextScopeTrigger() {
  const { colors } = useTheme();
  const { enabledScopes, setShowContextScope, showContextScope } = useAIStore();
  const count = enabledScopes.length;
  const label = count === 0
    ? 'No context'
    : count === 1
    ? CONTEXT_SCOPES[enabledScopes[0]].label
    : `${count} sources`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.trigger,
        { backgroundColor: pressed || showContextScope ? colors.bgHover : 'transparent' },
      ]}
      onPress={() => setShowContextScope(!showContextScope)}
    >
      <Text style={[styles.triggerIcon, { color: colors.textMuted }]}>⊕</Text>
      <Text style={[styles.triggerText, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -SCREEN_HEIGHT,
    left: -SCREEN_WIDTH,
    width: SCREEN_WIDTH * 3,
    height: SCREEN_HEIGHT * 3,
    zIndex: 99,
  },
  container: {
    position: 'absolute',
    bottom: spacing[16],
    left: spacing[4],
    right: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 100,
  },
  header: {
    padding: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { fontSize: typography.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  rowIcon: { fontSize: typography.base },
  rowLabel: { fontSize: typography.sm, fontWeight: typography.medium },
  check: { fontSize: typography.base, fontWeight: typography.semibold },
  footer: {
    padding: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { fontSize: typography.xs, textAlign: 'center' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
    gap: spacing[1],
  },
  triggerIcon: { fontSize: typography.sm },
  triggerText: { fontSize: typography.xs, fontWeight: typography.medium },
});
