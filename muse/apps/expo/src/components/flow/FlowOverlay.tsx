/**
 * FlowOverlay - Distraction-free writing overlay (Expo)
 *
 * Layout:
 * - Header: Timer (clickable), Word count, Focus toggle, Exit
 * - Timer Panel: Opens from left when timer in header is clicked
 * - Main: Editor content
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, spacing, useCurrentProjectId } from '@/design-system';
import {
  useFlowStore,
  useFlowEnabled,
  useFlowPreferences,
  useFlowTimer,
  useFlowSession,
  useShouldAutoReveal,
  useEditorWordCount,
  type SessionStats,
} from '@mythos/state';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';
import { FlowHeader } from './FlowHeader';
import { FlowTimerPanel } from './FlowTimerPanel';
import { FlowSummaryModal } from './FlowSummaryModal';

interface FlowOverlayProps {
  /** The editor/content to render - passed from AppShell */
  children?: ReactNode;
  /** Current word count from editor */
  wordCount?: number;
  /** Current document ID (for session tracking) */
  documentId?: string;
}

export function FlowOverlay({ children, wordCount: propWordCount = 0, documentId }: FlowOverlayProps) {
  const { colors, isDark } = useTheme();
  const enabled = useFlowEnabled();
  const preferences = useFlowPreferences();
  const timer = useFlowTimer();
  const session = useFlowSession();
  const shouldAutoReveal = useShouldAutoReveal();
  const projectId = useCurrentProjectId();
  const exitFlowMode = useFlowStore((s) => s.exitFlowMode);
  const updateWordCount = useFlowStore((s) => s.updateWordCount);
  const tickTimer = useFlowStore((s) => s.tickTimer);

  // Get word count from shared editor metrics store (preferred) or prop fallback
  const editorWordCount = useEditorWordCount();
  const wordCount = editorWordCount > 0 ? editorWordCount : propWordCount;

  // Convex mutation for persisting sessions
  const recordFlowSession = useMutation(api.flowSessions.record);

  // Component-local UI state for timer panel visibility
  const [showSummary, setShowSummary] = useState(false);
  const [showTimerPanel, setShowTimerPanel] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  // Track if we've already notified about auto-reveal (to avoid repeated opens)
  const hasNotifiedAutoReveal = useRef(false);

  // Update word count in store when it changes
  useEffect(() => {
    if (enabled) {
      updateWordCount(wordCount);
    }
  }, [enabled, wordCount, updateWordCount]);

  // Timer tick interval - runs for both 'running' and 'break' states
  useEffect(() => {
    if (!enabled) return;
    const isCountingDown = timer.state === 'running' || timer.state === 'break';
    if (!isCountingDown) return;

    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, timer.state, tickTimer]);

  // Reset auto-reveal notification when timer restarts
  useEffect(() => {
    if (timer.state === 'idle') {
      hasNotifiedAutoReveal.current = false;
    }
  }, [timer.state]);

  // NOTE: We intentionally do NOT auto-open the panel when shouldAutoReveal becomes true.
  // Instead, FlowHeader shows a subtle indicator dot. User can tap to open panel manually.

  // Handle exit - persist session to Convex and show summary
  const handleExit = useCallback(async () => {
    // Capture session data before exiting (session will be null after exit)
    const currentSession = session;
    const stats = exitFlowMode();
    setSessionStats(stats);

    // Persist to Convex if we have a project and valid session
    if (projectId && stats && currentSession) {
      try {
        await recordFlowSession({
          projectId: projectId as Id<'projects'>,
          documentId: documentId as Id<'documents'> | undefined,
          startedAtMs: stats.startedAtMs,
          endedAtMs: stats.endedAtMs,
          durationSeconds: stats.durationSeconds,
          startingWordCount: currentSession.startingWordCount,
          endingWordCount: currentSession.currentWordCount,
          wordsWritten: stats.wordsWritten,
          completedPomodoros: stats.completedPomodoros,
          totalFocusedSeconds: currentSession.totalFocusedSeconds,
          focusLevel: preferences.focusLevel,
          typewriterScrolling: preferences.typewriterScrolling,
          timerMode: timer.mode,
        });
      } catch (error) {
        // Silently fail - local session is still saved
        console.warn('Failed to persist flow session to Convex:', error);
      }
    }

    if (preferences.showSummaryOnExit && stats && stats.wordsWritten > 0) {
      setShowSummary(true);
    }
  }, [session, exitFlowMode, projectId, documentId, preferences, timer.mode, recordFlowSession]);

  // Handle timer press in header
  const handleTimerPress = useCallback(() => {
    setShowTimerPanel((prev) => !prev);
  }, []);

  // Handle timer panel close
  const handleTimerPanelClose = useCallback(() => {
    setShowTimerPanel(false);
  }, []);

  // Handle escape key (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showTimerPanel) {
          setShowTimerPanel(false);
        } else {
          handleExit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleExit, showTimerPanel]);

  // Close summary modal
  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    setSessionStats(null);
  }, []);

  // IMPORTANT: Always render the same component structure to prevent children remounting.
  // Use visibility/opacity instead of conditional rendering for the overlay elements.
  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {/* Flow header - only visible when enabled */}
      {enabled && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          <FlowHeader onExit={handleExit} onTimerPress={handleTimerPress} />
        </Animated.View>
      )}

      {/* Main content area - ALWAYS rendered to preserve children */}
      <View style={styles.mainArea}>
        {/* Timer panel (slides from left when open) */}
        {enabled && showTimerPanel && (
          <>
            {/* Backdrop to close panel */}
            <Animated.View
              entering={FadeIn.duration(100)}
              exiting={FadeOut.duration(80)}
              style={[
                styles.backdrop,
                { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)' },
              ]}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={handleTimerPanelClose} />
            </Animated.View>
            <FlowTimerPanel onClose={handleTimerPanelClose} />
          </>
        )}

        {/* Editor content - ALWAYS in the same position in component tree */}
        <View style={styles.content}>
          {children}
        </View>
      </View>

      {/* Summary modal (shown after exit) */}
      {showSummary && sessionStats && (
        <FlowSummaryModal stats={sessionStats} onClose={handleCloseSummary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainArea: {
    flex: 1,
    position: 'relative',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  content: {
    flex: 1,
  },
});
