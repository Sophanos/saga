/**
 * FlowOverlay - Full-screen distraction-free writing container (Expo)
 *
 * Creates an immersive, zen-like environment for focused writing.
 * Renders as a modal overlay when flow mode is enabled.
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, Modal, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/design-system';
import {
  useFlowStore,
  useFlowEnabled,
  useFlowPreferences,
  type SessionStats,
} from '@mythos/state';
import { FlowHeader } from './FlowHeader';
import { FlowSummaryModal } from './FlowSummaryModal';

interface FlowOverlayProps {
  /** The editor/content to render in flow mode */
  children?: ReactNode;
  /** Current word count from editor */
  wordCount?: number;
}

export function FlowOverlay({ children, wordCount = 0 }: FlowOverlayProps) {
  const { colors, isDark } = useTheme();
  const enabled = useFlowEnabled();
  const preferences = useFlowPreferences();
  const exitFlowMode = useFlowStore((s) => s.exitFlowMode);
  const updateWordCount = useFlowStore((s) => s.updateWordCount);

  const [showSummary, setShowSummary] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  // Update word count in store when it changes
  useEffect(() => {
    if (enabled) {
      updateWordCount(wordCount);
    }
  }, [enabled, wordCount, updateWordCount]);

  // Handle exit
  const handleExit = useCallback(() => {
    const stats = exitFlowMode();
    setSessionStats(stats);

    if (preferences.showSummaryOnExit && stats && stats.wordsWritten > 0) {
      setShowSummary(true);
    }
  }, [exitFlowMode, preferences.showSummaryOnExit]);

  // Handle escape key (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleExit]);

  // Close summary modal
  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    setSessionStats(null);
  }, []);

  // Summary modal (shown after exit)
  if (showSummary && sessionStats) {
    return <FlowSummaryModal stats={sessionStats} onClose={handleCloseSummary} />;
  }

  if (!enabled) {
    return null;
  }

  return (
    <Modal
      visible={enabled}
      animationType="none"
      transparent={false}
      onRequestClose={handleExit}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[styles.container, { backgroundColor: colors.bgApp }]}
      >
        {/* Vignette effect */}
        {Platform.OS === 'web' && (
          <View
            style={[
              styles.vignette,
              {
                // @ts-ignore - web-only style
                background: `radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, ${isDark ? 'rgba(25, 25, 25, 0.4)' : 'rgba(0, 0, 0, 0.1)'} 100%)`,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* Header */}
        <FlowHeader onExit={handleExit} />

        {/* Content area */}
        <View style={styles.content}>
          <View style={styles.contentInner}>
            {children}
          </View>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 16,
  },
  contentInner: {
    flex: 1,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  bottomPadding: {
    height: 32,
  },
});
