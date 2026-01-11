/**
 * AITemplateBuilder - Main component for AI-assisted template creation
 */

import { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, typography, radii, palette } from '@/design-system';
import type { GenesisEntity, TemplateDraft } from '@mythos/agent-protocol';
import { PROJECT_TYPE_DEFS, type ProjectType } from '@mythos/core';
import { useTemplateBuilderAgent, type BuilderMessage } from './useTemplateBuilderAgent';
import { PromptSuggestions } from './PromptSuggestions';
import { TemplateBuilderInput } from './TemplateBuilderInput';
import { PhaseIndicator } from './PhaseIndicator';
import { TemplatePreview } from './TemplatePreview';

interface AITemplateBuilderProps {
  projectType: ProjectType;
  onUseTemplate: (draft: TemplateDraft, starterEntities?: GenesisEntity[]) => void;
  onCancel?: () => void;
}

interface MessageBubbleProps {
  message: BuilderMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageBubbleContainer, isUser && styles.messageBubbleContainerUser]}>
      <View
        style={[
          styles.messageBubble,
          {
            backgroundColor: isUser ? `${palette.purple[400]}15` : colors.bgSurface,
          },
        ]}
      >
        <Text style={[styles.messageText, { color: colors.text }]}>
          {message.content}
          {message.isStreaming && (
            <View style={[styles.cursor, { backgroundColor: palette.purple[400] }]} />
          )}
        </Text>
      </View>
    </View>
  );
}

export function AITemplateBuilder({
  projectType,
  onUseTemplate,
  onCancel,
}: AITemplateBuilderProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    pendingTool,
    executeTool,
    rejectTool,
    draft,
    starterEntities,
    phase,
    markAccepted,
  } = useTemplateBuilderAgent({ projectType });

  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleSuggestionSelect = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleGenerate = useCallback(async () => {
    await executeTool();
  }, [executeTool]);

  const handleUseTemplate = useCallback(() => {
    if (!draft) return;
    markAccepted();
    onUseTemplate(draft, starterEntities);
  }, [draft, markAccepted, onUseTemplate, starterEntities]);

  const handleRefine = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const showEmptyState = messages.length === 0;
  const showGenerateButton = pendingTool?.status === 'proposed';
  const isExecuting = pendingTool?.status === 'executing';
  const placeholder = `Describe your ${PROJECT_TYPE_DEFS[projectType].label.toLowerCase()} idea...`;

  // Layout: side-by-side on wide screens, stacked on narrow
  if (isWide) {
    return (
      <View style={styles.wideContainer}>
        {/* Chat Panel */}
        <View style={[styles.chatPanel, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <View style={styles.chatContent}>
            {showEmptyState ? (
              <PromptSuggestions
                projectType={projectType}
                onSelect={handleSuggestionSelect}
                disabled={isStreaming}
              />
            ) : (
              <ScrollView
                ref={scrollRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.map((msg: BuilderMessage) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isStreaming && messages[messages.length - 1]?.role === 'user' && (
                  <View style={styles.thinkingContainer}>
                    <ActivityIndicator size="small" color={palette.purple[400]} />
                    <Text style={[styles.thinkingText, { color: colors.textMuted }]}>
                      Thinking...
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: `${palette.red[400]}15` }]}>
              <Text style={[styles.errorText, { color: palette.red[400] }]}>{error}</Text>
            </View>
          )}

          {/* Generate Button */}
          {showGenerateButton && (
            <View style={[styles.generateBox, { backgroundColor: `${palette.purple[400]}10`, borderColor: `${palette.purple[400]}30` }]}>
              <View style={styles.generateContent}>
                <Feather name="zap" size={16} color={palette.purple[400]} />
                <Text style={[styles.generateText, { color: colors.text }]}>
                  Ready to generate your template
                </Text>
              </View>
              <View style={styles.generateActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    { backgroundColor: pressed ? colors.bgHover : 'transparent' },
                  ]}
                  onPress={rejectTool}
                >
                  <Feather name="x" size={14} color={colors.textMuted} />
                  <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.generateButton,
                    { backgroundColor: pressed ? palette.purple[500] : palette.purple[400] },
                  ]}
                  onPress={handleGenerate}
                >
                  <Text style={styles.generateButtonText}>Generate</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Executing indicator */}
          {isExecuting && (
            <View style={[styles.generateBox, { backgroundColor: `${palette.purple[400]}10`, borderColor: `${palette.purple[400]}30` }]}>
              <View style={styles.generateContent}>
                <ActivityIndicator size="small" color={palette.purple[400]} />
                <Text style={[styles.generateText, { color: colors.text }]}>
                  Generating your template...
                </Text>
              </View>
            </View>
          )}

          <TemplateBuilderInput
            onSend={sendMessage}
            isStreaming={isStreaming || isExecuting}
            placeholder={placeholder}
            inputRef={inputRef}
          />
        </View>

        {/* Preview Panel */}
        <View style={[styles.previewPanel, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <View style={[styles.previewHeader, { borderBottomColor: colors.border }]}>
            <PhaseIndicator phase={phase} projectType={projectType} />
          </View>
          <View style={styles.previewContent}>
            <TemplatePreview
              projectType={projectType}
              phase={phase}
              draft={draft}
              starterEntities={starterEntities}
              isGenerating={isExecuting}
              isReadyToGenerate={showGenerateButton}
              onUseTemplate={handleUseTemplate}
              onCancel={onCancel}
              onRefine={handleRefine}
            />
          </View>
        </View>
      </View>
    );
  }

  // Narrow layout: single column
  return (
    <View style={styles.narrowContainer}>
      {/* Phase indicator at top */}
      <View style={[styles.narrowHeader, { borderBottomColor: colors.border }]}>
        <PhaseIndicator phase={phase} projectType={projectType} />
      </View>

      {/* Main content */}
      <View style={styles.narrowContent}>
        {draft ? (
          <TemplatePreview
            projectType={projectType}
            phase={phase}
            draft={draft}
            starterEntities={starterEntities}
            isGenerating={isExecuting}
            isReadyToGenerate={showGenerateButton}
            onUseTemplate={handleUseTemplate}
            onCancel={onCancel}
            onRefine={handleRefine}
          />
        ) : showEmptyState ? (
          <PromptSuggestions
            projectType={projectType}
            onSelect={handleSuggestionSelect}
            disabled={isStreaming}
          />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg: BuilderMessage) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && messages[messages.length - 1]?.role === 'user' && (
              <View style={styles.thinkingContainer}>
                <ActivityIndicator size="small" color={palette.purple[400]} />
                <Text style={[styles.thinkingText, { color: colors.textMuted }]}>Thinking...</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Error */}
      {error && (
        <View style={[styles.errorBox, { backgroundColor: `${palette.red[400]}15` }]}>
          <Text style={[styles.errorText, { color: palette.red[400] }]}>{error}</Text>
        </View>
      )}

      {/* Generate Button */}
      {showGenerateButton && (
        <View style={[styles.generateBox, { backgroundColor: `${palette.purple[400]}10`, borderColor: `${palette.purple[400]}30` }]}>
          <View style={styles.generateContent}>
            <Feather name="zap" size={16} color={palette.purple[400]} />
            <Text style={[styles.generateText, { color: colors.text }]}>
              Ready to generate
            </Text>
          </View>
          <View style={styles.generateActions}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                { backgroundColor: pressed ? colors.bgHover : 'transparent' },
              ]}
              onPress={rejectTool}
            >
              <Feather name="x" size={14} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.generateButton,
                { backgroundColor: pressed ? palette.purple[500] : palette.purple[400] },
              ]}
              onPress={handleGenerate}
            >
              <Text style={styles.generateButtonText}>Generate</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Executing indicator */}
      {isExecuting && (
        <View style={[styles.generateBox, { backgroundColor: `${palette.purple[400]}10`, borderColor: `${palette.purple[400]}30` }]}>
          <View style={styles.generateContent}>
            <ActivityIndicator size="small" color={palette.purple[400]} />
            <Text style={[styles.generateText, { color: colors.text }]}>Generating...</Text>
          </View>
        </View>
      )}

      {/* Input */}
      {!draft && (
        <TemplateBuilderInput
          onSend={sendMessage}
          isStreaming={isStreaming || isExecuting}
          placeholder={placeholder}
          inputRef={inputRef}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wide layout
  wideContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[4],
  },
  chatPanel: {
    flex: 1.1,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewPanel: {
    flex: 0.9,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chatContent: {
    flex: 1,
    minHeight: 0,
  },
  previewHeader: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewContent: {
    flex: 1,
    padding: spacing[4],
  },

  // Narrow layout
  narrowContainer: {
    flex: 1,
  },
  narrowHeader: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  narrowContent: {
    flex: 1,
  },

  // Messages
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: spacing[2],
    gap: spacing[1],
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  messageBubbleContainerUser: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
  },
  messageText: {
    fontSize: typography.sm,
    lineHeight: typography.sm * typography.relaxed,
  },
  cursor: {
    width: 6,
    height: 16,
    marginLeft: 2,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  thinkingText: {
    fontSize: typography.sm,
  },

  // Error
  errorBox: {
    marginHorizontal: spacing[3],
    marginBottom: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
  },
  errorText: {
    fontSize: typography.xs,
  },

  // Generate
  generateBox: {
    marginHorizontal: spacing[3],
    marginBottom: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  generateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  generateText: {
    fontSize: typography.sm,
    flex: 1,
  },
  generateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
  },
  cancelButtonText: {
    fontSize: typography.xs,
  },
  generateButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
});
