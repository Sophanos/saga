/**
 * MessageContent - Renders message text with inline tool calls and questions
 * Handles mixed content: text, tool executions, and pending questions
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme, spacing, typography } from '@/design-system';
import { ToolCallCard } from './ToolCallCard';
import { AskQuestionCard } from './AskQuestionCard';
import { useWorkspaceStore } from '@mythos/state';
import { useCallback } from 'react';

interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: unknown;
  error?: string;
}

interface PendingQuestion {
  id: string;
  question: string;
  options?: { label: string; value: string }[];
  context?: string;
  allowFreeform?: boolean;
  multiSelect?: boolean;
}

interface MessageContentProps {
  content: string;
  toolCalls?: ToolCall[];
  pendingQuestions?: PendingQuestion[];
  isUser?: boolean;
}

export function MessageContent({
  content,
  toolCalls,
  pendingQuestions,
  isUser = false,
}: MessageContentProps) {
  const { colors } = useTheme();
  const { answerQuestion, dismissQuestion } = useWorkspaceStore();

  const handleAnswer = useCallback((id: string, answer: string | string[]) => {
    answerQuestion(id, answer);
  }, [answerQuestion]);

  const handleDismiss = useCallback((id: string) => {
    dismissQuestion(id);
  }, [dismissQuestion]);

  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasQuestions = pendingQuestions && pendingQuestions.length > 0;
  const hasContent = content.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Text content */}
      {hasContent && (
        <Text style={[styles.text, { color: colors.text }]}>
          {content}
        </Text>
      )}

      {/* Tool calls */}
      {hasToolCalls && (
        <View style={styles.toolCallsContainer}>
          {toolCalls.map((tool, index) => (
            <Animated.View
              key={tool.id}
              entering={FadeInUp.delay(index * 50).duration(200)}
            >
              <ToolCallCard
                id={tool.id}
                name={tool.name}
                status={tool.status}
                result={tool.result}
                error={tool.error}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* Pending questions */}
      {hasQuestions && (
        <View style={styles.questionsContainer}>
          {pendingQuestions.map((question, index) => (
            <Animated.View
              key={question.id}
              entering={FadeInUp.delay(index * 100).duration(300)}
            >
              <AskQuestionCard
                id={question.id}
                question={question.question}
                options={question.options}
                context={question.context}
                allowFreeform={question.allowFreeform}
                multiSelect={question.multiSelect}
                onAnswer={handleAnswer}
                onDismiss={handleDismiss}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  text: {
    fontSize: typography.sm,
    lineHeight: typography.sm * 1.5,
  },
  toolCallsContainer: {
    gap: spacing[2],
  },
  questionsContainer: {
    gap: spacing[3],
  },
});
