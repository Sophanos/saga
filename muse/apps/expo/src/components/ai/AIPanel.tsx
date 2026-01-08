import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRef, useCallback, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme, spacing, sizing, typography, radii, shadows } from '@/design-system';
import { useLayoutStore, type AIPanelMode } from '@/design-system/layout';
import { useAIStore, useCurrentThread, useHasMessages, type QuickAction, type ChatMessage } from '@/stores/ai';
import { MuseAvatar } from './MuseAvatar';
import { ChatSelector } from './ChatSelector';
import { WelcomeState } from './WelcomeState';
import { AIPanelInput } from './AIPanelInput';

interface AIPanelProps {
  mode?: AIPanelMode;
}

export function AIPanel({ mode = 'side' }: AIPanelProps) {
  const { colors } = useTheme();
  const { setAIPanelMode } = useLayoutStore();
  const { showChatSelector, setShowChatSelector, sendMessage, createThread, isStreaming } = useAIStore();

  const thread = useCurrentThread();
  const hasMessages = useHasMessages();
  const scrollRef = useRef<ScrollView>(null);

  const handleQuickAction = useCallback((action: QuickAction) => {
    const actionMessages: Record<QuickAction, string> = {
      search: 'Search my story for...',
      lint: 'Find inconsistencies in my story',
      continue: 'Continue writing this scene',
      character: 'Help me create a new character',
      brainstorm: "Let's brainstorm ideas for my story",
      arc: 'Analyze the story arc',
    };
    sendMessage(actionMessages[action]);
  }, [sendMessage]);

  const handleSend = useCallback((message: string) => {
    sendMessage(message);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [sendMessage]);

  const content = (
    <View style={[
      styles.container,
      mode === 'full' && styles.containerFull,
      { backgroundColor: colors.sidebarBg, borderColor: colors.border },
    ]}>
      <AIPanelHeader
        threadName={thread?.name ?? 'New Chat'}
        mode={mode}
        onChatSelectorToggle={() => setShowChatSelector(!showChatSelector)}
        onNewChat={createThread}
        onModeChange={setAIPanelMode}
      />

      <ChatSelector visible={showChatSelector} onClose={() => setShowChatSelector(false)} />

      <View style={styles.content}>
        {hasMessages ? (
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={[styles.messagesContent, mode === 'full' && styles.messagesContentFull]}
            showsVerticalScrollIndicator={false}
          >
            {thread?.messages.map((msg, index) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={index === (thread.messages.length - 1)}
                fullWidth={mode === 'full'}
              />
            ))}
            {isStreaming && (
              <View style={styles.streamingIndicator}>
                <MuseAvatar size="message" thinking />
                <Text style={[styles.streamingText, { color: colors.textMuted }]}>Thinking...</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <WelcomeState onAction={handleQuickAction} />
        )}
      </View>

      <View style={[
        styles.inputContainer,
        mode === 'full' && styles.inputContainerFull,
        { borderTopColor: colors.border },
      ]}>
        <AIPanelInput onSend={handleSend} />
      </View>
    </View>
  );

  if (mode === 'floating') return <FloatingWrapper>{content}</FloatingWrapper>;
  return content;
}

interface AIPanelHeaderProps {
  threadName: string;
  mode: AIPanelMode;
  onChatSelectorToggle: () => void;
  onNewChat: () => void;
  onModeChange: (mode: AIPanelMode) => void;
}

function AIPanelHeader({ threadName, mode, onChatSelectorToggle, onNewChat, onModeChange }: AIPanelHeaderProps) {
  const { colors } = useTheme();
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  // Mode-specific actions
  const actions = getActionsForMode(mode);

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable
        style={({ pressed }) => [styles.chatSelectorBtn, { backgroundColor: pressed ? colors.bgHover : 'transparent' }]}
        onPress={onChatSelectorToggle}
      >
        <Text style={[styles.chatSelectorText, { color: colors.text }]} numberOfLines={1}>{threadName}</Text>
        <Text style={[styles.chatSelectorChevron, { color: colors.textMuted }]}>▾</Text>
      </Pressable>

      <View style={styles.headerActions}>
        {actions.map((action) => (
          <View key={action.id}>
            <Pressable
              style={({ pressed }) => [styles.headerBtn, { backgroundColor: pressed ? colors.bgHover : 'transparent' }]}
              onPress={() => action.id === 'new' ? onNewChat() : onModeChange(action.targetMode!)}
              onHoverIn={() => setHoveredBtn(action.id)}
              onHoverOut={() => setHoveredBtn(null)}
            >
              <Text style={[styles.headerBtnIcon, { color: colors.textMuted }]}>{action.icon}</Text>
            </Pressable>
            {hoveredBtn === action.id && (
              <View style={[styles.tooltip, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
                <Text style={[styles.tooltipText, { color: colors.text }]}>{action.label}</Text>
                {action.shortcut && <Text style={[styles.tooltipShortcut, { color: colors.textMuted }]}>{action.shortcut}</Text>}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

interface HeaderAction {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  targetMode?: AIPanelMode;
}

function getActionsForMode(mode: AIPanelMode): HeaderAction[] {
  switch (mode) {
    case 'side':
      return [
        { id: 'new', icon: '↗', label: 'New Chat', shortcut: '⌘⇧;' },
        { id: 'float', icon: '◳', label: 'Float', targetMode: 'floating' },
        { id: 'full', icon: '⬜', label: 'Expand', targetMode: 'full' },
        { id: 'hide', icon: '»', label: 'Close', targetMode: 'hidden' },
      ];
    case 'floating':
      return [
        { id: 'new', icon: '↗', label: 'New Chat', shortcut: '⌘⇧;' },
        { id: 'dock', icon: '▣', label: 'Dock', targetMode: 'side' },
        { id: 'full', icon: '⬜', label: 'Expand', targetMode: 'full' },
        { id: 'hide', icon: '×', label: 'Close', targetMode: 'hidden' },
      ];
    case 'full':
      return [
        { id: 'new', icon: '↗', label: 'New Chat', shortcut: '⌘⇧;' },
        { id: 'dock', icon: '▣', label: 'Side Panel', targetMode: 'side' },
        { id: 'float', icon: '◳', label: 'Float', targetMode: 'floating' },
        { id: 'hide', icon: '»', label: 'Close', targetMode: 'hidden' },
      ];
    default:
      return [];
  }
}

function MessageBubble({ message, isLast, fullWidth }: { message: ChatMessage; isLast: boolean; fullWidth?: boolean }) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';

  return (
    <Animated.View
      entering={isLast ? FadeInDown.duration(300) : undefined}
      style={[styles.messageBubble, isUser && styles.messageBubbleUser, fullWidth && styles.messageBubbleFull]}
    >
      {!isUser && <View style={styles.messageAvatar}><MuseAvatar size="message" /></View>}
      <View
        style={[
          styles.messageContent,
          { backgroundColor: isUser ? colors.bgElevated : 'transparent', borderColor: isUser ? colors.border : 'transparent' },
          isUser && styles.messageContentUser,
          fullWidth && styles.messageContentFull,
        ]}
      >
        <Text style={[styles.messageText, { color: colors.text }]}>{message.content}</Text>
      </View>
    </Animated.View>
  );
}

function FloatingWrapper({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);
  const scale = useSharedValue(1);

  const drag = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
      scale.value = withSpring(1.02);
    })
    .onUpdate((e) => {
      translateX.value = contextX.value + e.translationX;
      translateY.value = contextY.value + e.translationY;
    })
    .onEnd(() => { scale.value = withSpring(1); });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={[styles.floatingContainer, animatedStyle, shadows.lg, { backgroundColor: colors.sidebarBg, borderColor: colors.border }]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  containerFull: { borderLeftWidth: 0, maxWidth: 900, alignSelf: 'center', width: '100%' },
  floatingContainer: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    width: sizing.rightPanelFloating,
    height: 560,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  chatSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
    gap: spacing[1],
    maxWidth: '60%',
  },
  chatSelectorText: { fontSize: typography.sm, fontWeight: typography.semibold },
  chatSelectorChevron: { fontSize: typography.xs },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[0.5] },
  headerBtn: { width: 32, height: 32, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  headerBtnIcon: { fontSize: typography.base },
  tooltip: {
    position: 'absolute',
    top: 36,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[3],
    zIndex: 200,
  },
  tooltipText: { fontSize: typography.sm, fontWeight: typography.medium },
  tooltipShortcut: { fontSize: typography.xs },
  content: { flex: 1 },
  messages: { flex: 1 },
  messagesContent: { padding: spacing[4], gap: spacing[4] },
  messagesContentFull: { paddingHorizontal: spacing[8], maxWidth: 800, alignSelf: 'center', width: '100%' },
  messageBubble: { flexDirection: 'row', gap: spacing[2] },
  messageBubbleUser: { justifyContent: 'flex-end' },
  messageBubbleFull: { maxWidth: 800 },
  messageAvatar: { marginTop: spacing[0.5] },
  messageContent: { flex: 1, maxWidth: '85%', padding: spacing[3], borderRadius: radii.lg, borderWidth: 1 },
  messageContentUser: { flex: 0, marginLeft: 'auto' },
  messageContentFull: { maxWidth: '70%' },
  messageText: { fontSize: typography.sm, lineHeight: typography.sm * typography.normal },
  streamingIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  streamingText: { fontSize: typography.sm, fontStyle: 'italic' },
  inputContainer: { padding: spacing[3], borderTopWidth: StyleSheet.hairlineWidth },
  inputContainerFull: { paddingHorizontal: spacing[8], maxWidth: 800, alignSelf: 'center', width: '100%' },
});
