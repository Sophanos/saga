/**
 * AIPanel - Main AI chat panel
 * Notion-inspired design with chat history, model selection, context scope
 * Supports: sticky (right column), floating (draggable), detached (window)
 */

import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRef, useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme, spacing, sizing, typography, radii, shadows } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import {
  useAIStore,
  useCurrentThread,
  useHasMessages,
  type QuickAction,
  type ChatMessage,
} from '@/stores/ai';
import { MuseAvatar } from './MuseAvatar';
import { ChatSelector } from './ChatSelector';
import { WelcomeState } from './WelcomeState';
import { AIPanelInput } from './AIPanelInput';

interface AIPanelProps {
  floating?: boolean;
}

export function AIPanel({ floating }: AIPanelProps) {
  const { colors } = useTheme();
  const { setAIPanelMode, aiPanelMode } = useLayoutStore();
  const {
    showChatSelector,
    setShowChatSelector,
    sendMessage,
    isStreaming,
  } = useAIStore();

  const thread = useCurrentThread();
  const hasMessages = useHasMessages();
  const scrollRef = useRef<ScrollView>(null);

  const handleQuickAction = useCallback((action: QuickAction) => {
    // Convert quick action to a message
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
    // Scroll to bottom after sending
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [sendMessage]);

  const content = (
    <View style={[styles.container, { backgroundColor: colors.sidebarBg, borderColor: colors.border }]}>
      {/* Header */}
      <AIPanelHeader
        threadName={thread?.name ?? 'New Chat'}
        onChatSelectorToggle={() => setShowChatSelector(!showChatSelector)}
        onModeToggle={() => setAIPanelMode(aiPanelMode === 'sticky' ? 'floating' : 'sticky')}
        onClose={() => setAIPanelMode('hidden')}
        isSticky={aiPanelMode === 'sticky'}
      />

      {/* Chat selector dropdown */}
      <ChatSelector
        visible={showChatSelector}
        onClose={() => setShowChatSelector(false)}
      />

      {/* Content area */}
      <View style={styles.content}>
        {hasMessages ? (
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {thread?.messages.map((msg, index) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={index === (thread.messages.length - 1)}
              />
            ))}
            {isStreaming && (
              <View style={styles.streamingIndicator}>
                <MuseAvatar size="message" thinking />
                <Text style={[styles.streamingText, { color: colors.textMuted }]}>
                  Thinking...
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <WelcomeState onAction={handleQuickAction} />
        )}
      </View>

      {/* Input bar */}
      <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
        <AIPanelInput onSend={handleSend} />
      </View>
    </View>
  );

  if (floating) {
    return <FloatingWrapper>{content}</FloatingWrapper>;
  }

  return content;
}

interface AIPanelHeaderProps {
  threadName: string;
  onChatSelectorToggle: () => void;
  onModeToggle: () => void;
  onClose: () => void;
  isSticky: boolean;
}

function AIPanelHeader({
  threadName,
  onChatSelectorToggle,
  onModeToggle,
  onClose,
  isSticky,
}: AIPanelHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {/* Left: Chat selector */}
      <Pressable
        style={({ pressed }) => [
          styles.chatSelectorBtn,
          { backgroundColor: pressed ? colors.bgHover : 'transparent' },
        ]}
        onPress={onChatSelectorToggle}
      >
        <Text style={[styles.chatSelectorText, { color: colors.text }]} numberOfLines={1}>
          {threadName}
        </Text>
        <Text style={[styles.chatSelectorChevron, { color: colors.textMuted }]}>▾</Text>
      </Pressable>

      {/* Right: Window controls */}
      <View style={styles.headerActions}>
        {/* Pop out */}
        <HeaderButton icon="⊡" onPress={() => {}} tooltip="Pop out" />
        {/* Toggle dock/float */}
        <HeaderButton
          icon={isSticky ? '◱' : '▣'}
          onPress={onModeToggle}
          tooltip={isSticky ? 'Float' : 'Dock'}
        />
        {/* Close */}
        <HeaderButton icon="×" onPress={onClose} tooltip="Close" />
      </View>
    </View>
  );
}

function HeaderButton({
  icon,
  onPress,
  tooltip,
}: {
  icon: string;
  onPress: () => void;
  tooltip: string;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.headerBtn,
        { backgroundColor: pressed ? colors.bgHover : 'transparent' },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.headerBtnIcon, { color: colors.textMuted }]}>{icon}</Text>
    </Pressable>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLast: boolean;
}

function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';

  return (
    <Animated.View
      entering={isLast ? FadeInDown.duration(300) : undefined}
      style={[
        styles.messageBubble,
        isUser && styles.messageBubbleUser,
      ]}
    >
      {!isUser && (
        <View style={styles.messageAvatar}>
          <MuseAvatar size="message" />
        </View>
      )}
      <View
        style={[
          styles.messageContent,
          {
            backgroundColor: isUser ? colors.bgElevated : 'transparent',
            borderColor: isUser ? colors.border : 'transparent',
          },
          isUser && styles.messageContentUser,
        ]}
      >
        <Text style={[styles.messageText, { color: colors.text }]}>
          {message.content}
        </Text>
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
    .onUpdate((event) => {
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;
    })
    .onEnd(() => {
      scale.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={[
          styles.floatingContainer,
          animatedStyle,
          shadows.lg,
          { backgroundColor: colors.sidebarBg, borderColor: colors.border },
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
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
  chatSelectorText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  chatSelectorChevron: {
    fontSize: typography.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnIcon: {
    fontSize: typography.base,
  },
  content: {
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing[4],
    gap: spacing[4],
  },
  messageBubble: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  messageBubbleUser: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    marginTop: spacing[0.5],
  },
  messageContent: {
    flex: 1,
    maxWidth: '85%',
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  messageContentUser: {
    flex: 0,
    marginLeft: 'auto',
  },
  messageText: {
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.normal,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  streamingText: {
    fontSize: typography.sm,
    fontStyle: 'italic',
  },
  inputContainer: {
    padding: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
