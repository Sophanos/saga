/**
 * FlowOverlay - Full-screen distraction-free writing container
 *
 * Creates an immersive, zen-like environment for focused writing.
 * Renders as a portal over the entire application when flow mode is enabled.
 */

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  useFlowStore,
  useFlowEnabled,
  useFlowPreferences,
  useDimOpacity,
  useTypewriterScrolling,
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
  const exitFlowMode = useFlowStore((s) => s.exitFlowMode);
  const updateWordCount = useFlowStore((s) => s.updateWordCount);

  const [isExiting, setIsExiting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

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

      {/* Flow header */}
      <FlowHeader onExit={handleExit} />

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

      {/* Bottom breathing room */}
      <div className="h-8 flex-shrink-0" />
    </div>
  );

  // Render as portal to ensure it's on top of everything
  return createPortal(overlayContent, document.body);
}
