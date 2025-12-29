/**
 * CaptureModal - Bottom Sheet with Capture Type Options
 *
 * A modal that presents capture type options:
 * - Text Note (quick text entry)
 * - Voice Memo (audio recording)
 * - Photo (camera/gallery)
 * - Flag Passage (contextual, for marking text in documents)
 */

import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useEffect, useCallback } from "react";
import { Mic, Camera, FileText, Flag, X } from "lucide-react-native";
import type { CaptureKind } from "@mythos/state";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MODAL_HEIGHT = 320;

export interface CaptureModalProps {
  /**
   * Whether the modal is visible
   */
  visible: boolean;
  /**
   * Callback when modal is closed
   */
  onClose: () => void;
  /**
   * Callback when a capture type is selected
   */
  onSelectType: (type: CaptureKind) => void;
  /**
   * Whether to show the flag passage option (contextual)
   */
  showFlagOption?: boolean;
}

interface CaptureOptionProps {
  icon: typeof FileText;
  label: string;
  description: string;
  color: string;
  onPress: () => void;
  delay?: number;
}

function CaptureOption({
  icon: Icon,
  label,
  description,
  color,
  onPress,
  delay = 0,
}: CaptureOptionProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 20, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.optionButton}
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityRole="button"
      >
        <View style={[styles.optionIcon, { backgroundColor: color + "20" }]}>
          <Icon size={24} color={color} />
        </View>
        <View style={styles.optionTextContainer}>
          <Text style={styles.optionLabel}>{label}</Text>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Modal component for selecting capture type.
 *
 * Features:
 * - Bottom sheet style modal
 * - Animated entrance/exit
 * - Large tappable buttons with icons
 * - Dark theme styling
 */
export function CaptureModal({
  visible,
  onClose,
  onSelectType,
  showFlagOption = false,
}: CaptureModalProps) {
  // Animation values
  const translateY = useSharedValue(MODAL_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Animate modal when visibility changes
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(MODAL_HEIGHT, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  // Handle option selection
  const handleSelect = useCallback(
    (type: CaptureKind) => {
      onSelectType(type);
    },
    [onSelectType]
  );

  // Handle backdrop press
  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  // Animated styles
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const captureOptions: Array<{
    type: CaptureKind;
    icon: typeof FileText;
    label: string;
    description: string;
    color: string;
    show: boolean;
  }> = [
    {
      type: "text",
      icon: FileText,
      label: "Text Note",
      description: "Quick text capture",
      color: "#22d3ee",
      show: true,
    },
    {
      type: "voice",
      icon: Mic,
      label: "Voice Memo",
      description: "Record audio note",
      color: "#4ade80",
      show: true,
    },
    {
      type: "photo",
      icon: Camera,
      label: "Photo",
      description: "Capture an image",
      color: "#fbbf24",
      show: true,
    },
    {
      type: "flag",
      icon: Flag,
      label: "Flag Passage",
      description: "Mark text for later",
      color: "#f87171",
      show: showFlagOption,
    },
  ];

  const visibleOptions = captureOptions.filter((opt) => opt.show);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
        <Pressable style={styles.backdropPressable} onPress={handleBackdropPress} />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View style={[styles.modalContainer, modalAnimatedStyle]}>
        {/* Handle Bar */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quick Capture</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <X size={20} color="#71717a" />
          </Pressable>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {visibleOptions.map((option, index) => (
            <CaptureOption
              key={option.type}
              icon={option.icon}
              label={option.label}
              description={option.description}
              color={option.color}
              onPress={() => handleSelect(option.type)}
              delay={index * 50}
            />
          ))}
        </View>
      </Animated.View>
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
  modalContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#12121a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40, // Safe area
    minHeight: MODAL_HEIGHT,
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
  optionsContainer: {
    padding: 16,
    gap: 12,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a24",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e4e4e7",
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: "#71717a",
  },
});

export default CaptureModal;
