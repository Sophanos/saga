/**
 * FlowOverlay - Distraction-free writing overlay (Expo)
 *
 * Layout:
 * - Header: Word count, focus toggle, exit button
 * - Left edge: Vertical timer rail (hides when running)
 * - Main: Editor content
 */

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, spacing } from '@/design-system';
import {
  useFlowStore,
  useFlowEnabled,
  useFlowPreferences,
  useFlowTimer,
  type SessionStats,
} from '@mythos/state';
import { FlowHeader } from './FlowHeader';
import { FlowTimerVisual } from './FlowTimerVisual';
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
  const timer = useFlowTimer();
  const exitFlowMode = useFlowStore((s) => s.exitFlowMode);
  const updateWordCount = useFlowStore((s) => s.updateWordCount);
  const tickTimer = useFlowStore((s) => s.tickTimer);

  const [showSummary, setShowSummary] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  // Update word count in store when it changes
  useEffect(() => {
    if (enabled) {
      updateWordCount(wordCount);
    }
  }, [enabled, wordCount, updateWordCount]);

  // Timer tick interval
  useEffect(() => {
    if (!enabled || timer.state !== 'running') return;

    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, timer.state, tickTimer]);

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

  // Flow mode: show header + side timer + children (editor)
  if (enabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
        {/* Flow header with word count, focus toggle, exit */}
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          <FlowHeader onExit={handleExit} />
        </Animated.View>

        {/* Main content area with side timer */}
        <View style={styles.mainArea}>
          {/* Left side: Timer rail */}
          <View style={styles.timerSide}>
            <FlowTimerVisual height={240} />
          </View>

          {/* Editor content */}
          <View style={styles.content}>
            {children}
          </View>
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
  mainArea: {
    flex: 1,
    flexDirection: 'row',
  },
  timerSide: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[4],
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});
