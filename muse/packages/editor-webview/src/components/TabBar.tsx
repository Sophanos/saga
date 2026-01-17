import { useState, useCallback, useRef, useEffect } from 'react';
import { TabPreview, useTabPreview } from './TabPreview';

// DEV: Enable widget status testing buttons (set via console: window.__DEV_TAB_INDICATORS__ = true)
declare global {
  interface Window {
    __DEV_TAB_INDICATORS__?: boolean;
  }
}

export type TabWidgetStatus = 'idle' | 'running' | 'ready' | 'failed';

export interface Tab {
  id: string;
  title: string;
  content?: string; // Preview content (first ~200 chars)
  isActive?: boolean;
  isDirty?: boolean;
  /** Widget execution status for this document */
  widgetStatus?: TabWidgetStatus;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  /** When true, adds left padding for the sidebar toggle button */
  sidebarCollapsed?: boolean;
  /** Widget status per document (keyed by tab id) - for production use */
  widgetStatusMap?: Record<string, TabWidgetStatus>;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  onNavigateBack,
  onNavigateForward,
  canGoBack = false,
  canGoForward = false,
  sidebarCollapsed = false,
  widgetStatusMap = {},
}: TabBarProps) {
  const preview = useTabPreview(400);
  // DEV: Internal state for testing widget indicators
  const [devWidgetStatus, setDevWidgetStatus] = useState<TabWidgetStatus>('idle');

  // Merge tabs with widget status (from props or dev testing)
  const tabsWithStatus = tabs.map((tab) => ({
    ...tab,
    widgetStatus: tab.id === activeTabId
      ? (widgetStatusMap[tab.id] ?? devWidgetStatus)
      : (widgetStatusMap[tab.id] ?? tab.widgetStatus),
  }));

  return (
    <div className="tab-bar" style={sidebarCollapsed ? { paddingLeft: 44 } : undefined}>
      <div className="tab-bar-nav">
        <button
          className="nav-button"
          onClick={onNavigateBack}
          disabled={!canGoBack}
          aria-label="Go back"
        >
          <ChevronLeftIcon />
        </button>
        <button
          className="nav-button"
          onClick={onNavigateForward}
          disabled={!canGoForward}
          aria-label="Go forward"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="tab-bar-tabs">
        {tabsWithStatus.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => onTabSelect(tab.id)}
            onClose={() => onTabClose(tab.id)}
            onHoverStart={(element) => {
              preview.showPreview(tab.id, tab.title, tab.content, element);
            }}
            onHoverEnd={preview.hidePreview}
          />
        ))}
        <button className="tab-new" onClick={onNewTab} aria-label="New tab">
          <PlusIcon />
        </button>
        <DevWidgetTestButton
          currentStatus={devWidgetStatus}
          onStatusChange={setDevWidgetStatus}
        />
      </div>

      <TabPreview
        title={preview.previewData?.title || ''}
        content={preview.previewData?.content}
        isVisible={preview.isVisible}
        anchorRect={preview.anchorRect}
      />

      <style>{`
        .tab-bar {
          display: flex;
          align-items: center;
          height: 40px;
          background: var(--color-bg-app);
          padding: 0 8px;
          gap: 2px;
          user-select: none;
          -webkit-app-region: drag;
        }

        .tab-bar-nav {
          display: flex;
          align-items: center;
          gap: 0;
          padding-right: 8px;
          -webkit-app-region: no-drag;
        }

        .nav-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          border-radius: 4px;
          cursor: pointer;
          transition: background 80ms ease-out;
        }

        .nav-button:hover:not(:disabled) {
          background: var(--color-bg-hover);
        }

        .nav-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .nav-button svg {
          width: 14px;
          height: 14px;
        }

        .tab-bar-tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          flex: 1;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-app-region: no-drag;
          scrollbar-width: none;
        }

        .tab-bar-tabs::-webkit-scrollbar {
          display: none;
        }

        .tab-new {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          border-radius: 4px;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 80ms ease-out;
        }

        .tab-new:hover {
          background: var(--color-bg-hover);
        }

        .tab-new svg {
          width: 14px;
          height: 14px;
        }
      `}</style>
    </div>
  );
}

interface TabIndicatorProps {
  isDirty?: boolean;
  widgetStatus?: TabWidgetStatus;
}

/**
 * TabIndicator - Shows document status (dirty, widget running/ready/failed)
 * Priority: widgetStatus > isDirty (widget status takes precedence)
 */
function TabIndicator({ isDirty, widgetStatus }: TabIndicatorProps) {
  // Widget status takes priority over dirty state
  if (widgetStatus === 'running') {
    return <span className="tab-indicator tab-indicator--spinner" aria-label="Widget running" />;
  }

  if (widgetStatus === 'ready') {
    return <span className="tab-indicator tab-indicator--ready" aria-label="Widget ready" />;
  }

  if (widgetStatus === 'failed') {
    return <span className="tab-indicator tab-indicator--failed" aria-label="Widget failed" />;
  }

  // Only show dirty indicator if actually dirty and no widget status
  if (isDirty === true) {
    return <span className="tab-indicator tab-indicator--dirty" aria-label="Unsaved changes" />;
  }

  return null;
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onHoverStart: (element: HTMLElement) => void;
  onHoverEnd: () => void;
}

function TabItem({ tab, isActive, onSelect, onClose, onHoverStart, onHoverEnd }: TabItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (elementRef.current) {
      onHoverStart(elementRef.current);
    }
  }, [onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHoverEnd();
  }, [onHoverEnd]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  return (
    <div
      ref={elementRef}
      className={`tab-item ${isActive ? 'tab-item--active' : ''}`}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TabIndicator
        isDirty={tab.isDirty}
        widgetStatus={tab.widgetStatus}
      />
      <span
        className={`tab-item-title ${tab.widgetStatus === 'running' ? 'tab-item-title--shimmer' : ''}`}
        data-ai-shimmer={tab.widgetStatus === 'running' ? 'true' : undefined}
      >
        {tab.title || 'Untitled'}
      </span>
      <button
        className={`tab-item-close ${isHovered || isActive ? 'tab-item-close--visible' : ''}`}
        onClick={handleClose}
        aria-label={`Close ${tab.title}`}
      >
        <CloseIcon />
      </button>

      <style>{`
        .tab-item {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          padding: 0 6px 0 10px;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: background 80ms ease-out;
          max-width: 180px;
          min-width: 0;
        }

        .tab-item:hover {
          background: var(--color-bg-hover);
        }

        .tab-item--active {
          background: var(--color-bg-surface);
        }

        .tab-item--active:hover {
          background: var(--color-bg-surface);
        }

        /* Tab Indicator States */
        .tab-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Dirty state - subtle blue */
        .tab-indicator--dirty {
          background: #5e9fd0;
        }

        /* Running - spinner animation */
        .tab-indicator--spinner {
          border: 1.5px solid transparent;
          border-top-color: var(--color-accent, #5e9fd0);
          border-right-color: var(--color-accent, #5e9fd0);
          animation: tab-spinner 0.8s linear infinite;
        }

        @keyframes tab-spinner {
          to { transform: rotate(360deg); }
        }

        /* Ready - accent dot with subtle pulse */
        .tab-indicator--ready {
          background: var(--color-accent, #5e9fd0);
          animation: tab-pulse 2s ease-in-out infinite;
        }

        @keyframes tab-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Failed - red/orange attention */
        .tab-indicator--failed {
          background: #e5534b;
        }

        .tab-item-title {
          font-size: 13px;
          font-weight: 400;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        .tab-item--active .tab-item-title {
          color: var(--color-text-secondary);
        }

        .tab-item-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          border-radius: 4px;
          cursor: pointer;
          flex-shrink: 0;
          opacity: 0;
          transition: all 80ms ease-out;
        }

        .tab-item-close--visible {
          opacity: 1;
        }

        .tab-item-close:hover {
          background: var(--color-bg-active);
        }

        .tab-item-close svg {
          width: 8px;
          height: 8px;
        }

        /* AI Shimmer - text gradient animation for running state */
        @keyframes ai-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .tab-item-title--shimmer {
          background: linear-gradient(
            90deg,
            var(--color-text-muted) 0%,
            var(--color-text-muted) 35%,
            rgba(255, 255, 255, 0.9) 50%,
            var(--color-text-muted) 65%,
            var(--color-text-muted) 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: ai-shimmer 2s ease-in-out infinite;
        }

        .tab-item--active .tab-item-title--shimmer {
          background: linear-gradient(
            90deg,
            var(--color-text-secondary) 0%,
            var(--color-text-secondary) 35%,
            rgba(255, 255, 255, 0.95) 50%,
            var(--color-text-secondary) 65%,
            var(--color-text-secondary) 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: ai-shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Icons
function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8L10 4" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4L10 8L6 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3V13M3 8H13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4L12 12M12 4L4 12" />
    </svg>
  );
}

// DEV: Widget status testing component
interface DevWidgetTestProps {
  onStatusChange: (status: TabWidgetStatus) => void;
  currentStatus?: TabWidgetStatus;
}

function DevWidgetTestButton({ onStatusChange, currentStatus = 'idle' }: DevWidgetTestProps) {
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    // Check for dev mode flag
    const checkDevMode = () => {
      setIsDevMode(typeof window !== 'undefined' && window.__DEV_TAB_INDICATORS__ === true);
    };
    checkDevMode();

    // Re-check periodically in case it's set via console
    const interval = setInterval(checkDevMode, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isDevMode) return null;

  const states: TabWidgetStatus[] = ['idle', 'running', 'ready', 'failed'];
  const currentIndex = states.indexOf(currentStatus);
  const nextStatus = states[(currentIndex + 1) % states.length];

  const statusLabels: Record<TabWidgetStatus, string> = {
    idle: '○',
    running: '⟳',
    ready: '●',
    failed: '✕',
  };

  return (
    <button
      className="dev-widget-test"
      onClick={() => onStatusChange(nextStatus)}
      title={`DEV: Widget status = ${currentStatus}, click for ${nextStatus}`}
    >
      {statusLabels[currentStatus]}
      <style>{`
        .dev-widget-test {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: 1px dashed var(--color-text-muted);
          background: transparent;
          color: var(--color-accent);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          margin-left: 4px;
          opacity: 0.6;
          transition: opacity 80ms ease-out;
        }
        .dev-widget-test:hover {
          opacity: 1;
          background: var(--color-bg-hover);
        }
      `}</style>
    </button>
  );
}
