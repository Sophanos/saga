/**
 * FlowOverlay - Full-screen distraction-free writing container
 *
 * Creates an immersive, zen-like environment for focused writing.
 * Renders as a portal over the entire application when flow mode is enabled.
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  useFlowStore,
  useFlowEnabled,
  useFlowPreferences,
  useDimOpacity,
  useTypewriterScrolling,
  useSessionWordsWritten,
  type SessionStats,
} from "@mythos/state";
import { FlowHeader } from "./FlowHeader";
import { FlowSummaryModal } from "./FlowSummaryModal";

interface FlowOverlayProps {
  /** The editor/content to render in flow mode */
  children?: ReactNode;
  /** Current word count from editor */
  wordCount?: number;
}

export function FlowOverlay({ children, wordCount = 0 }: FlowOverlayProps) {
  const enabled = useFlowEnabled();
  const preferences = useFlowPreferences();
  const dimOpacity = useDimOpacity();
  const typewriterScrolling = useTypewriterScrolling();
  const wordsWritten = useSessionWordsWritten();
  const exitFlowMode = useFlowStore((s) => s.exitFlowMode);
  const updateWordCount = useFlowStore((s) => s.updateWordCount);

  const [isExiting, setIsExiting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [headerVisible, setHeaderVisible] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update word count in store when it changes
  useEffect(() => {
    if (enabled) {
      updateWordCount(wordCount);
    }
  }, [enabled, wordCount, updateWordCount]);

  // Handle exit with animation
  const handleExit = useCallback(() => {
    setIsExiting(true);

    // Get stats before exiting
    const stats = exitFlowMode();
    setSessionStats(stats);

    // Show summary if preference enabled and we have stats
    if (preferences.showSummaryOnExit && stats && stats.wordsWritten > 0) {
      setTimeout(() => {
        setIsExiting(false);
        setShowSummary(true);
      }, 300);
    } else {
      setTimeout(() => {
        setIsExiting(false);
      }, 300);
    }
  }, [exitFlowMode, preferences.showSummaryOnExit]);

  // Handle escape key
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleExit]);

  // Set CSS variable for dim opacity
  useEffect(() => {
    if (enabled) {
      document.documentElement.style.setProperty("--flow-dim-opacity", String(dimOpacity));
    }
  }, [enabled, dimOpacity]);

  // Auto-hide header - show on mouse proximity to top edge
  useEffect(() => {
    if (!enabled) return;

    const TRIGGER_ZONE = 60; // px from top to trigger header
    const HIDE_DELAY = 400; // ms delay before hiding

    const handleMouseMove = (e: MouseEvent) => {
      const isNearTop = e.clientY < TRIGGER_ZONE;

      if (isNearTop) {
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        setHeaderVisible(true);
      } else {
        // Delay hiding to prevent flickering
        if (!hideTimeoutRef.current) {
          hideTimeoutRef.current = setTimeout(() => {
            setHeaderVisible(false);
            hideTimeoutRef.current = null;
          }, HIDE_DELAY);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [enabled]);

  // Close summary modal
  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    setSessionStats(null);
  }, []);

  // Don't render if not enabled and not showing summary
  if (!enabled && !showSummary) {
    return null;
  }

  // Summary modal (shown after exit)
  if (showSummary && sessionStats) {
    return <FlowSummaryModal stats={sessionStats} onClose={handleCloseSummary} />;
  }

  // Main overlay
  if (!enabled) {
    return null;
  }

  const overlayContent = (
    <div
      className={`
        flow-overlay fixed inset-0 z-50 flex flex-col
        bg-mythos-bg-primary
        ${isExiting ? "exiting" : ""}
        ${typewriterScrolling ? "flow-typewriter" : ""}
      `}
      data-testid="flow-overlay"
    >
      {/* Subtle vignette effect for immersion */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 60% at 50% 50%,
              transparent 0%,
              rgba(25, 25, 25, 0.4) 100%
            )
          `,
        }}
      />

      {/* Flow header - auto-hides, appears on mouse proximity to top */}
      <div
        className={`
          transition-all duration-200 ease-out
          ${headerVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}
        `}
      >
        <FlowHeader onExit={handleExit} />
      </div>

      {/* Content area */}
      <div
        className={`
          flow-mode relative z-10 flex-1 overflow-auto
          px-4 md:px-8 lg:px-16 xl:px-32
        `}
      >
        <div className="mx-auto max-w-3xl w-full h-full">
          {children}
        </div>
      </div>

      {/* Bottom-left word counter - subtle, dimmed */}
      <div className="fixed bottom-4 left-4 z-20">
        <span
          className="flow-stat text-sm"
          style={{ opacity: dimOpacity }}
        >
          {wordsWritten.toLocaleString()} words
          {preferences.sessionWordGoal && (
            <span className="text-mythos-text-muted">
              {" "}/ {preferences.sessionWordGoal.toLocaleString()}
            </span>
          )}
        </span>
      </div>

      {/* Bottom breathing room */}
      <div className="h-8 flex-shrink-0" />
    </div>
  );

  // Render as portal to ensure it's on top of everything
  return createPortal(overlayContent, document.body);
}
