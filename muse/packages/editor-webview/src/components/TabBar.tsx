import { useState, useCallback, useRef } from 'react';
import { TabPreview, useTabPreview } from './TabPreview';

export interface Tab {
  id: string;
  title: string;
  content?: string; // Preview content (first ~200 chars)
  isActive?: boolean;
  isDirty?: boolean;
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
}: TabBarProps) {
  const preview = useTabPreview(400);

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
        {tabs.map((tab) => (
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
      {tab.isDirty && <span className="tab-item-dirty" />}
      <span className="tab-item-title">
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

        .tab-item-dirty {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #5e9fd0;
          flex-shrink: 0;
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
