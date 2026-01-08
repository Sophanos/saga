import { useState, useCallback } from 'react';

export interface Tab {
  id: string;
  title: string;
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
}: TabBarProps) {
  return (
    <div className="tab-bar">
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
          />
        ))}
        <button className="tab-new" onClick={onNewTab} aria-label="New tab">
          <PlusIcon />
        </button>
      </div>

      <style>{`
        .tab-bar {
          display: flex;
          align-items: center;
          height: var(--tab-bar-height);
          background: var(--color-bg-surface);
          border-bottom: 1px solid var(--color-border);
          padding: 0 var(--space-3);
          gap: var(--space-1);
          user-select: none;
          -webkit-app-region: drag;
        }

        .tab-bar-nav {
          display: flex;
          align-items: center;
          gap: var(--space-0-5);
          padding-right: var(--space-2);
          border-right: 1px solid var(--color-border-subtle);
          margin-right: var(--space-1);
          -webkit-app-region: no-drag;
        }

        .nav-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .nav-button:hover:not(:disabled) {
          background: var(--color-bg-hover);
          color: var(--color-text-secondary);
        }

        .nav-button:active:not(:disabled) {
          background: var(--color-bg-active);
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
          gap: var(--space-0-5);
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
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          cursor: pointer;
          flex-shrink: 0;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .tab-new:hover {
          background: var(--color-bg-hover);
          color: var(--color-text-secondary);
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
}

function TabItem({ tab, isActive, onSelect, onClose }: TabItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  return (
    <div
      className={`tab-item ${isActive ? 'tab-item--active' : ''}`}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="tab-item-title">
        {tab.isDirty && <span className="tab-item-dirty" />}
        {tab.title || 'Untitled'}
      </span>
      {(isHovered || isActive) && (
        <button
          className="tab-item-close"
          onClick={handleClose}
          aria-label={`Close ${tab.title}`}
        >
          <CloseIcon />
        </button>
      )}

      <style>{`
        .tab-item {
          display: flex;
          align-items: center;
          gap: var(--space-1-5);
          height: 32px;
          padding: 0 var(--space-2) 0 var(--space-3);
          background: transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
          max-width: 180px;
          min-width: 0;
        }

        .tab-item:hover {
          background: var(--color-bg-hover);
        }

        .tab-item--active {
          background: var(--color-bg-elevated);
        }

        .tab-item--active:hover {
          background: var(--color-bg-elevated);
        }

        .tab-item-title {
          display: flex;
          align-items: center;
          gap: var(--space-1-5);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        .tab-item--active .tab-item-title {
          color: var(--color-text);
        }

        .tab-item-dirty {
          width: 6px;
          height: 6px;
          border-radius: var(--radius-full);
          background: var(--color-accent);
          flex-shrink: 0;
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
          border-radius: var(--radius-sm);
          cursor: pointer;
          flex-shrink: 0;
          opacity: 0;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .tab-item:hover .tab-item-close,
        .tab-item--active .tab-item-close {
          opacity: 1;
        }

        .tab-item-close:hover {
          background: var(--color-bg-active);
          color: var(--color-text);
        }

        .tab-item-close svg {
          width: 10px;
          height: 10px;
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
