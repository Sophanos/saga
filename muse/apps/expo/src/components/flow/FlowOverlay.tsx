/**
 * FlowOverlay - Distraction-free writing overlay (Expo)
 *
 * Instead of a Modal, this component:
 * 1. Renders a header bar when flow mode is enabled
 * 2. The parent (AppShell) hides sidebar/panels based on flow state
 * 3. Children (the editor) render normally underneath
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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
  /** The editor/content to render - passed from AppShell */
  children?: ReactNode;
  /** Current word count from editor */
  wordCount?: number;
}

export function FlowOverlay({ children, wordCount = 0 }: FlowOverlayProps) {
  const { colors } = useTheme();
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
    return (
      <>
        {children}
        <FlowSummaryModal stats={sessionStats} onClose={handleCloseSummary} />
      </>
    );
  }

  // Flow mode: show header + children (editor)
  if (enabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
        {/* Flow header with timer, word count, exit */}
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          <FlowHeader onExit={handleExit} />
        </Animated.View>

        {/* Editor content */}
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

  // Normal mode: just render children
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
