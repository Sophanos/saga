/**
 * WidgetPreviewModal - Preview widget output before applying
 *
 * Shows generated content with options to:
 * - Edit title (for artifacts)
 * - Cancel and discard
 * - Confirm and apply/create
 */

import { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';
import {
  useWidgetStatus,
  useWidgetPreviewContent,
  useWidgetLabel,
  useWidgetType,
  useWidgetTitle,
  useWidgetError,
  useWidgetExecutionStore,
} from '@mythos/state';

export interface WidgetPreviewModalProps {
  onConfirm: () => void;
}

export function WidgetPreviewModal({ onConfirm }: WidgetPreviewModalProps) {
  const { colors, isDark } = useTheme();

  const status = useWidgetStatus();
  const previewContent = useWidgetPreviewContent();
  const widgetLabel = useWidgetLabel();
  const widgetType = useWidgetType();
  const title = useWidgetTitle();
  const error = useWidgetError();

  const setTitle = useWidgetExecutionStore((s) => s.setTitle);
  const reset = useWidgetExecutionStore((s) => s.reset);
  const cancel = useWidgetExecutionStore((s) => s.cancel);

  const [showFullPreview, setShowFullPreview] = useState(false);

  const visible = status === 'preview' || status === 'error';
  const isArtifact = widgetType === 'artifact';
  const actionLabel = isArtifact ? 'Create' : 'Insert';

  const handleConfirm = useCallback(() => {
    onConfirm();
    reset();
  }, [onConfirm, reset]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  // Truncate preview if too long
  const MAX_PREVIEW_LENGTH = 2000;
  const isTruncated = (previewContent?.length ?? 0) > MAX_PREVIEW_LENGTH;
  const displayContent = showFullPreview
    ? previewContent
    : previewContent?.slice(0, MAX_PREVIEW_LENGTH);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleCancel} />

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={[
            styles.modal,
            {
              backgroundColor: colors.bgApp,
              borderColor: isDark ? palette.gray[700] : palette.gray[200],
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: isDark ? palette.gray[800] : palette.gray[100] },
            ]}
          >
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {actionLabel} {widgetLabel}
            </Text>
            <Pressable onPress={handleCancel} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Error state */}
          {status === 'error' && error && (
            <View
              style={[
                styles.errorContainer,
                { backgroundColor: isDark ? palette.red[500] + '20' : palette.red[400] + '15' },
              ]}
            >
              <Feather name="alert-circle" size={16} color={palette.red[500]} />
              <Text style={[styles.errorText, { color: palette.red[500] }]}>{error}</Text>
            </View>
          )}

          {/* Title input for artifacts */}
          {isArtifact && status === 'preview' && (
            <View style={styles.titleContainer}>
              <Text style={[styles.titleLabel, { color: colors.textMuted }]}>Title</Text>
              <TextInput
                style={[
                  styles.titleInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? palette.gray[900] : palette.gray[50],
                    borderColor: isDark ? palette.gray[700] : palette.gray[200],
                  },
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter artifact title..."
                placeholderTextColor={colors.textMuted}
                maxLength={100}
              />
            </View>
          )}

          {/* Content preview */}
          {status === 'preview' && previewContent && (
            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
              <Text style={[styles.contentText, { color: colors.text }]}>{displayContent}</Text>

              {isTruncated && !showFullPreview && (
                <Pressable onPress={() => setShowFullPreview(true)}>
                  <Text style={[styles.showMoreText, { color: colors.accent }]}>
                    Show full preview
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          )}

          {/* Actions */}
          <View
            style={[
              styles.actions,
              { borderTopColor: isDark ? palette.gray[800] : palette.gray[100] },
            ]}
          >
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                {
                  backgroundColor: pressed
                    ? isDark
                      ? palette.gray[800]
                      : palette.gray[100]
                    : 'transparent',
                  borderColor: isDark ? palette.gray[700] : palette.gray[200],
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={status === 'error' || !previewContent}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor:
                    status === 'error' || !previewContent
                      ? colors.textMuted
                      : pressed
                        ? palette.blue[600]
                        : colors.accent,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>{actionLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    maxHeight: '80%',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    margin: spacing[4],
    padding: spacing[3],
    borderRadius: radii.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sm,
  },
  titleContainer: {
    padding: spacing[4],
    paddingBottom: 0,
  },
  titleLabel: {
    fontSize: typography.xs,
    marginBottom: spacing[1],
  },
  titleInput: {
    padding: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    fontSize: typography.base,
  },
  contentScroll: {
    flex: 1,
    maxHeight: 300,
  },
  contentContainer: {
    padding: spacing[4],
  },
  contentText: {
    fontSize: typography.sm,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  showMoreText: {
    marginTop: spacing[2],
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[4],
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radii.md,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  buttonText: {
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
});
