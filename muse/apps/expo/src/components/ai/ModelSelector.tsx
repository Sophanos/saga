import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, spacing, radii, typography, shadows } from '@/design-system';
import { useAIStore, AI_MODELS, type AIModel } from '@/stores/ai';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModelSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export function ModelSelector({ visible, onClose }: ModelSelectorProps) {
  const { colors } = useTheme();
  const { selectedModel, setSelectedModel } = useAIStore();

  if (!visible) return null;

  const handleSelect = (model: AIModel) => {
    setSelectedModel(model);
    onClose();
  };

  const models = Object.entries(AI_MODELS) as [AIModel, typeof AI_MODELS[AIModel]][];

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
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
            Choose model
          </Text>
        </View>

        {models.map(([key, model]) => (
          <Pressable
            key={key}
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: pressed ? colors.bgHover : 'transparent' },
            ]}
            onPress={() => handleSelect(key)}
          >
            <View style={styles.itemInfo}>
              <ModelIcon model={key} />
              <Text style={[styles.itemLabel, { color: colors.text }]}>{model.label}</Text>
              {model.badge && (
                <View style={[styles.badge, { backgroundColor: colors.bgActive }]}>
                  <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{model.badge}</Text>
                </View>
              )}
            </View>
            {selectedModel === key && (
              <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
            )}
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

function ModelIcon({ model }: { model: AIModel }) {
  const { colors } = useTheme();
  const iconStyles: Record<AIModel, { bg: string; symbol: string }> = {
    auto: { bg: colors.accent, symbol: '✦' },
    'claude-sonnet': { bg: '#D97706', symbol: '✧' },
    'claude-opus': { bg: '#7C3AED', symbol: '✧' },
    'gemini-flash': { bg: '#2563EB', symbol: '◆' },
    'gpt-4o': { bg: '#10B981', symbol: '◎' },
  };
  const style = iconStyles[model];

  return (
    <View style={[styles.icon, { backgroundColor: style.bg }]}>
      <Text style={styles.iconText}>{style.symbol}</Text>
    </View>
  );
}

export function ModelSelectorTrigger() {
  const { colors } = useTheme();
  const { selectedModel, setShowModelSelector, showModelSelector } = useAIStore();
  const model = AI_MODELS[selectedModel];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.trigger,
        { backgroundColor: pressed || showModelSelector ? colors.bgHover : 'transparent' },
      ]}
      onPress={() => setShowModelSelector(!showModelSelector)}
    >
      <Text style={[styles.triggerIcon, { color: colors.textMuted }]}>✎</Text>
      <Text style={[styles.triggerText, { color: colors.textSecondary }]}>
        {selectedModel === 'auto' ? 'Auto' : model.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1000,
    overflow: 'visible',
  },
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  itemLabel: { fontSize: typography.sm, fontWeight: typography.medium },
  badge: {
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
    borderRadius: radii.sm,
  },
  badgeText: { fontSize: typography.xs, fontWeight: typography.medium },
  check: { fontSize: typography.base, fontWeight: typography.semibold },
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
