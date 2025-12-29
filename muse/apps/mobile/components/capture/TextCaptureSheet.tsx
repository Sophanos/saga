/**
 * TextCaptureSheet - Quick Text Entry Interface
 *
 * A modal/bottom sheet for quickly capturing text notes.
 * Features auto-focus, optional title, and submit/cancel actions.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { X, Send } from "lucide-react-native";

export interface TextCaptureSheetProps {
  /**
   * Whether the sheet is visible
   */
  visible: boolean;
  /**
   * Callback when sheet is closed
   */
  onClose: () => void;
  /**
   * Callback when text is submitted
   */
  onSubmit: (data: { title?: string; content: string }) => void;
  /**
   * Whether submission is in progress
   */
  isSubmitting?: boolean;
  /**
   * Placeholder text for content input
   */
  placeholder?: string;
  /**
   * Whether to show the title field
   */
  showTitle?: boolean;
}

/**
 * Quick text capture sheet component.
 *
 * Features:
 * - Auto-focus on open
 * - Optional title field
 * - Submit and cancel buttons
 * - Keyboard-aware positioning
 * - Dark theme styling
 */
export function TextCaptureSheet({
  visible,
  onClose,
  onSubmit,
  isSubmitting = false,
  placeholder = "Capture your thought...",
  showTitle = true,
}: TextCaptureSheetProps) {
  // State for form fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Refs for input focus
  const contentInputRef = useRef<TextInput>(null);
  const titleInputRef = useRef<TextInput>(null);

  // Animation values
  const translateY = useSharedValue(500);
  const backdropOpacity = useSharedValue(0);

  // Reset form when closing
  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
  }, []);

  // Animate and focus when visibility changes
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });

      // Auto-focus the appropriate input
      const focusTimeout = setTimeout(() => {
        if (showTitle) {
          titleInputRef.current?.focus();
        } else {
          contentInputRef.current?.focus();
        }
      }, 100);

      return () => clearTimeout(focusTimeout);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(500, { duration: 200 });
      resetForm();
    }
  }, [visible, translateY, backdropOpacity, showTitle, resetForm]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    Keyboard.dismiss();
    onSubmit({
      title: title.trim() || undefined,
      content: trimmedContent,
    });
  }, [content, title, onSubmit]);

  // Handle close
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  // Check if can submit
  const canSubmit = content.trim().length > 0 && !isSubmitting;

  // Animated styles
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Modal Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.modalContainer, modalAnimatedStyle]}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quick Note</Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <X size={20} color="#71717a" />
            </Pressable>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Optional Title Input */}
            {showTitle && (
              <TextInput
                ref={titleInputRef}
                value={title}
                onChangeText={setTitle}
                placeholder="Title (optional)"
                placeholderTextColor="#52525b"
                style={styles.titleInput}
                returnKeyType="next"
                onSubmitEditing={() => contentInputRef.current?.focus()}
                blurOnSubmit={false}
                editable={!isSubmitting}
              />
            )}

            {/* Content Input */}
            <TextInput
              ref={contentInputRef}
              value={content}
              onChangeText={setContent}
              placeholder={placeholder}
              placeholderTextColor="#52525b"
              style={styles.contentInput}
              multiline
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleClose}
              style={styles.cancelButton}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              style={[
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
              ]}
              accessibilityLabel="Save note"
              accessibilityRole="button"
              disabled={!canSubmit}
            >
              <Send
                size={18}
                color={canSubmit ? "#0a0a0f" : "#52525b"}
              />
              <Text
                style={[
                  styles.submitButtonText,
                  !canSubmit && styles.submitButtonTextDisabled,
                ]}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  backdropPressable: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#12121a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24, // Safe area for iOS
    maxHeight: "80%",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#3f3f46",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e4e4e7",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1a1a24",
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    padding: 16,
    gap: 12,
  },
  titleInput: {
    backgroundColor: "#1a1a24",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "500",
    color: "#e4e4e7",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  contentInput: {
    backgroundColor: "#1a1a24",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    color: "#e4e4e7",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    minHeight: 120,
    maxHeight: 200,
    lineHeight: 22,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#1a1a24",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#22d3ee",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#27272a",
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0f",
  },
  submitButtonTextDisabled: {
    color: "#52525b",
  },
});

export default TextCaptureSheet;
