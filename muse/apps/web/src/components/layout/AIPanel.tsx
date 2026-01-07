/**
 * AIPanel - Chat interface
 * Supports: sticky (right column) or floating (draggable overlay)
 */

import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useState, useRef } from 'react';
import { useTheme, spacing, sizing, typography, radii } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface AIPanelProps {
  floating?: boolean;
}

export function AIPanel({ floating }: AIPanelProps) {
  const { colors } = useTheme();
  const { setAIPanelMode, aiPanelMode } = useLayoutStore();
  const [input, setInput] = useState('');

  // Mock messages - replace with Convex query
  const messages = [
    { id: '1', role: 'assistant', content: 'Hi! How can I help with your story?' },
  ];

  const content = (
    <View style={[styles.container, { backgroundColor: colors.sidebarBg, borderColor: colors.border }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>AI Chat</Text>
        <View style={styles.headerActions}>
          {/* Toggle sticky/floating */}
          <Pressable
            onPress={() => setAIPanelMode(aiPanelMode === 'sticky' ? 'floating' : 'sticky')}
            style={styles.headerBtn}
          >
            <Text style={{ color: colors.textMuted }}>{aiPanelMode === 'sticky' ? '◱' : '▣'}</Text>
          </Pressable>
          {/* Close */}
          <Pressable onPress={() => setAIPanelMode('hidden')} style={styles.headerBtn}>
            <Text style={{ color: colors.textMuted }}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Messages */}
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.message,
              msg.role === 'user' && styles.messageUser,
              { backgroundColor: msg.role === 'user' ? colors.bgElevated : 'transparent' },
            ]}
          >
            <Text style={[styles.messageIcon, { color: colors.textMuted }]}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </Text>
            <Text style={[styles.messageText, { color: colors.text }]}>{msg.content}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <QuickAction label="🔍 Lint" onPress={() => {}} />
          <QuickAction label="📊 Analyze" onPress={() => {}} />
          <QuickAction label="🎭 Character" onPress={() => {}} />
          <QuickAction label="🌍 World" onPress={() => {}} />
        </ScrollView>
      </View>

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.text }]}
          placeholder="Ask about your story..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, { backgroundColor: colors.accent }]}
          onPress={() => {
            if (input.trim()) {
              // Send message
              setInput('');
            }
          }}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </Pressable>
      </View>
    </View>
  );

  if (floating) {
    return <FloatingWrapper>{content}</FloatingWrapper>;
  }

  return content;
}

function FloatingWrapper({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  const drag = Gesture.Pan()
    .onStart(() => {
      contextX.value = translateX.value;
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={[
          styles.floatingContainer,
          animatedStyle,
          {
            shadowColor: colors.bgApp,
          },
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        styles.quickAction,
        { backgroundColor: colors.bgElevated, borderColor: colors.border },
        hovered && { backgroundColor: colors.bgHover },
      ]}
    >
      <Text style={[styles.quickActionText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderLeftWidth: 1,
  },
  floatingContainer: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    width: sizing.rightPanelWidth,
    height: 480,
    borderRadius: radii.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  headerBtn: {
    padding: spacing[1],
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing[4],
    gap: spacing[3],
  },
  message: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.md,
  },
  messageUser: {
    marginLeft: spacing[6],
  },
  messageIcon: {
    fontSize: typography.sm,
  },
  messageText: {
    flex: 1,
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.normal,
  },
  quickActions: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  quickAction: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    marginRight: spacing[2],
  },
  quickActionText: {
    fontSize: typography.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing[4],
    gap: spacing[2],
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.sm,
    maxHeight: 100,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: typography.bold,
  },
});
