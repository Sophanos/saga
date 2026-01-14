import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRef, useCallback, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, sizing, typography, radii, shadows } from '@/design-system';
import { useLayoutStore, type AIPanelMode, useAIStore, useCurrentThread, useHasMessages, type QuickAction, type ChatMessage } from '@mythos/state';
import { useSagaAgent } from '@/hooks';
import { MuseAvatar } from './MuseAvatar';
import { ChatSelector } from './ChatSelector';
import { WelcomeState } from './WelcomeState';
import { AIPanelInput } from './AIPanelInput';
import { MessageContent } from './MessageContent';

interface AIPanelProps {
  mode?: AIPanelMode;
}

export function AIPanel({ mode = 'side' }: AIPanelProps) {
  const { colors } = useTheme();
  const { setAIPanelMode } = useLayoutStore();
  const { showChatSelector, setShowChatSelector, createThread } = useAIStore();
  const { sendMessage, isStreaming } = useSagaAgent();

  const thread = useCurrentThread();
  const hasMessages = useHasMessages();
  const scrollRef = useRef<ScrollView>(null);

  const handleQuickAction = useCallback((action: QuickAction) => {
    const actionMessages: Record<QuickAction, string> = {
      search: 'Search my project for...',
      review: 'Review this project for issues',
      draft_next: 'Draft the next section',
      create_entity: 'Help me create a new entity',
      brainstorm: "Let's brainstorm ideas for this project",
      analyze_structure: 'Analyze the structure and flow',
      clarity_check: 'Check this text for clarity issues like ambiguous pronouns and clichés',
      policy_check: 'Check this text against my pinned style policies',
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
        onNewChat={() => createThread()}
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
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable
        style={({ pressed }) => [styles.chatSelectorBtn, { backgroundColor: pressed ? colors.bgHover : 'transparent' }]}
        onPress={onChatSelectorToggle}
      >
        <Text style={[styles.chatSelectorText, { color: colors.text }]} numberOfLines={1}>{threadName}</Text>
        <Feather name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>

      <View style={styles.headerActions}>
        {/* New Chat */}
        <View>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, { backgroundColor: pressed ? colors.bgHover : 'transparent' }]}
            onPress={onNewChat}
            onHoverIn={() => setHoveredBtn('new')}
            onHoverOut={() => setHoveredBtn(null)}
          >
            <Feather name="edit" size={18} color={colors.textMuted} />
          </Pressable>
          {hoveredBtn === 'new' && (
            <Tooltip label="New Chat" shortcut="⌘⇧;" colors={colors} />
          )}
        </View>

        {/* Mode Toggle */}
        <View style={styles.menuContainer}>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, { backgroundColor: pressed || showModeMenu ? colors.bgHover : 'transparent' }]}
            onPress={() => setShowModeMenu(!showModeMenu)}
          >
            <Feather name={mode === 'full' ? 'maximize-2' : mode === 'floating' ? 'square' : 'sidebar'} size={18} color={colors.textMuted} />
          </Pressable>
          {showModeMenu && (
            <ModeMenu
              currentMode={mode}
              onSelect={(m) => { onModeChange(m); setShowModeMenu(false); }}
              onClose={() => setShowModeMenu(false)}
              colors={colors}
            />
          )}
        </View>

        {/* Hide */}
        <View>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, { backgroundColor: pressed ? colors.bgHover : 'transparent' }]}
            onPress={() => onModeChange('hidden')}
            onHoverIn={() => setHoveredBtn('hide')}
            onHoverOut={() => setHoveredBtn(null)}
          >
            <Feather name="minus" size={18} color={colors.textMuted} />
          </Pressable>
          {hoveredBtn === 'hide' && (
            <Tooltip label="Hide Chat" shortcut="⌘J" colors={colors} />
          )}
        </View>
      </View>
    </View>
  );
}

function Tooltip({ label, shortcut, colors }: { label: string; shortcut?: string; colors: any }) {
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
      style={[styles.tooltip, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
    >
      <Text style={[styles.tooltipText, { color: colors.text }]}>{label}</Text>
      {shortcut && <Text style={[styles.tooltipShortcut, { color: colors.textMuted }]}>{shortcut}</Text>}
    </Animated.View>
  );
}

function ModeMenu({ currentMode, onSelect, onClose, colors }: {
  currentMode: AIPanelMode;
  onSelect: (mode: AIPanelMode) => void;
  onClose: () => void;
  colors: any;
}) {
  const modes: { mode: AIPanelMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { mode: 'side', label: 'Side Panel', icon: 'sidebar' },
    { mode: 'floating', label: 'Floating', icon: 'square' },
    { mode: 'full', label: 'Full Screen', icon: 'maximize-2' },
  ];

  return (
    <>
      <Pressable style={styles.menuBackdrop} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={[styles.modeMenu, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
      >
        {modes.map(({ mode, label, icon }) => (
          <Pressable
            key={mode}
            style={({ pressed }) => [
              styles.modeMenuItem,
              { backgroundColor: pressed ? colors.bgHover : 'transparent' },
            ]}
            onPress={() => onSelect(mode)}
          >
            <Feather name={icon} size={16} color={colors.textMuted} />
            <Text style={[styles.modeMenuText, { color: colors.text }]}>{label}</Text>
            {currentMode === mode && <Feather name="check" size={16} color={colors.accent} />}
          </Pressable>
        ))}
      </Animated.View>
    </>
  );
}

function MessageBubble({ message, isLast, fullWidth }: { message: ChatMessage; isLast: boolean; fullWidth?: boolean }) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const hasToolContent = (message.toolCalls?.length ?? 0) > 0 || (message.pendingQuestions?.length ?? 0) > 0;

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
          hasToolContent && styles.messageContentWithTools,
        ]}
      >
        <MessageContent
          content={message.content}
          toolCalls={message.toolCalls}
          pendingQuestions={message.pendingQuestions}
          isUser={isUser}
        />
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
  containerFull: { borderLeftWidth: 0 },
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
    zIndex: 100,
    overflow: 'visible',
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], overflow: 'visible' },
  headerBtn: { width: 32, height: 32, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  menuContainer: { position: 'relative', zIndex: 200, overflow: 'visible' },
  tooltip: {
    position: 'absolute',
    top: 38,
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
  menuBackdrop: { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: 199 },
  modeMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    minWidth: 160,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: spacing[1],
    zIndex: 200,
  },
  modeMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  modeMenuText: { flex: 1, fontSize: typography.sm },
  content: { flex: 1, zIndex: 1 },
  messages: { flex: 1 },
  messagesContent: { padding: spacing[4], gap: spacing[4] },
  messagesContentFull: { paddingHorizontal: spacing[8] },
  messageBubble: { flexDirection: 'row', gap: spacing[2] },
  messageBubbleUser: { justifyContent: 'flex-end' },
  messageBubbleFull: { maxWidth: 800 },
  messageAvatar: { marginTop: spacing[0.5] },
  messageContent: { flex: 1, maxWidth: '85%', padding: spacing[3], borderRadius: radii.lg, borderWidth: 1 },
  messageContentUser: { flex: 0, marginLeft: 'auto' },
  messageContentFull: { maxWidth: '70%' },
  messageContentWithTools: { maxWidth: '100%', flex: 1 },
  streamingIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  streamingText: { fontSize: typography.sm, fontStyle: 'italic' },
  inputContainer: { padding: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, zIndex: 50, overflow: 'visible' },
  inputContainerFull: { paddingHorizontal: spacing[8] },
});
