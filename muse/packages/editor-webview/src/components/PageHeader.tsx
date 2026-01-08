import { useState, useRef, useEffect } from 'react';

type PrivacyLevel = 'private' | 'workspace' | 'public';

interface PageHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  privacyLevel?: PrivacyLevel;
  onPrivacyChange?: (level: PrivacyLevel) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onShare?: () => void;
  onMoreClick?: () => void;
  showMoreMenu?: boolean;
}

export function PageHeader({
  title,
  onTitleChange,
  privacyLevel = 'private',
  onPrivacyChange,
  isFavorite = false,
  onToggleFavorite,
  onShare,
  onMoreClick,
  showMoreMenu = false,
}: PageHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (editedTitle.trim() !== title) {
      onTitleChange(editedTitle.trim() || 'Untitled');
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditingTitle(false);
    }
  };

  const privacyConfig: Record<PrivacyLevel, { label: string; icon: JSX.Element }> = {
    private: { label: 'Private', icon: <LockIcon /> },
    workspace: { label: 'Workspace', icon: <UsersIcon /> },
    public: { label: 'Public', icon: <GlobeIcon /> },
  };

  return (
    <header className="page-header">
      <div className="page-header-left">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            className="page-header-title-input"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyDown}
          />
        ) : (
          <button
            className="page-header-title"
            onClick={() => setIsEditingTitle(true)}
          >
            {title || 'Untitled'}
          </button>
        )}

        <div className="privacy-dropdown">
          <button
            className="privacy-button"
            onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
          >
            {privacyConfig[privacyLevel].icon}
            <span>{privacyConfig[privacyLevel].label}</span>
            <ChevronDownIcon />
          </button>

          {showPrivacyMenu && (
            <>
              <div className="privacy-backdrop" onClick={() => setShowPrivacyMenu(false)} />
              <div className="privacy-menu">
                {(Object.keys(privacyConfig) as PrivacyLevel[]).map((level) => (
                  <button
                    key={level}
                    className={`privacy-menu-item ${level === privacyLevel ? 'privacy-menu-item--active' : ''}`}
                    onClick={() => {
                      onPrivacyChange?.(level);
                      setShowPrivacyMenu(false);
                    }}
                  >
                    {privacyConfig[level].icon}
                    <span>{privacyConfig[level].label}</span>
                    {level === privacyLevel && <CheckIcon />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="page-header-right">
        <button className="header-action share-button" onClick={onShare}>
          Share
        </button>

        <button
          className={`header-action icon-button ${isFavorite ? 'icon-button--active' : ''}`}
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <StarIcon filled={isFavorite} />
        </button>

        <button
          className={`header-action icon-button ${showMoreMenu ? 'icon-button--active' : ''}`}
          onClick={onMoreClick}
          aria-label="More options"
        >
          <MoreIcon />
        </button>
      </div>

      <style>{`
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: var(--header-height);
          padding: 0 var(--space-4);
          background: var(--color-bg-surface);
          border-bottom: 1px solid var(--color-border);
        }

        .page-header-left {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-width: 0;
        }

        .page-header-title {
          font-family: var(--font-display);
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--color-text);
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          padding: var(--space-1) var(--space-2);
          margin: 0 calc(var(--space-2) * -1);
          cursor: pointer;
          transition: background var(--duration-fast) var(--ease-out);
          max-width: 300px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
        }

        .page-header-title:hover {
          background: var(--color-bg-hover);
        }

        .page-header-title-input {
          font-family: var(--font-display);
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--color-text);
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-1) var(--space-2);
          margin: 0 calc(var(--space-2) * -1);
          outline: none;
          width: 200px;
        }

        .page-header-title-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px var(--color-accent-subtle);
        }

        .privacy-dropdown {
          position: relative;
        }

        .privacy-button {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          padding: var(--space-1) var(--space-1-5);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .privacy-button:hover {
          background: var(--color-bg-hover);
          color: var(--color-text-secondary);
        }

        .privacy-button svg {
          width: 14px;
          height: 14px;
        }

        .privacy-button svg:last-child {
          width: 12px;
          height: 12px;
          opacity: 0.6;
        }

        .privacy-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
        }

        .privacy-menu {
          position: absolute;
          top: calc(100% + var(--space-1));
          left: 0;
          min-width: 160px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-1);
          z-index: 101;
          box-shadow: var(--shadow-lg);
          animation: menuFadeIn var(--duration-fast) var(--ease-out);
        }

        @keyframes menuFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .privacy-menu-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-2-5);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
          text-align: left;
        }

        .privacy-menu-item:hover {
          background: var(--color-bg-hover);
          color: var(--color-text);
        }

        .privacy-menu-item--active {
          color: var(--color-text);
        }

        .privacy-menu-item svg {
          width: 16px;
          height: 16px;
        }

        .privacy-menu-item svg:last-child {
          margin-left: auto;
          color: var(--color-accent);
        }

        .page-header-right {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .header-action {
          border: none;
          background: transparent;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .share-button {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--color-text-secondary);
          padding: var(--space-1-5) var(--space-3);
        }

        .share-button:hover {
          background: var(--color-bg-hover);
          color: var(--color-text);
        }

        .icon-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          color: var(--color-text-muted);
        }

        .icon-button:hover {
          background: var(--color-bg-hover);
          color: var(--color-text-secondary);
        }

        .icon-button--active {
          background: var(--color-bg-hover);
          color: var(--color-amber);
        }

        .icon-button svg {
          width: 18px;
          height: 18px;
        }
      `}</style>
    </header>
  );
}

// Icons
function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M11 6V4a3 3 0 10-6 0v2H4a1 1 0 00-1 1v6a1 1 0 001 1h8a1 1 0 001-1V7a1 1 0 00-1-1h-1zM6 4a2 2 0 114 0v2H6V4z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 8a2 2 0 100-4 2 2 0 000 4zm4-2a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM6 9c-2.67 0-4 1.33-4 2.5V13h8v-1.5c0-1.17-1.33-2.5-4-2.5zm4.5.5c1.61 0 2.5.89 2.5 2v1H11v-1.5c0-.66-.18-1.23-.5-1.7.33-.19.67-.3 1-.3z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.5 1.5 2 3.5 2 6s-.5 4.5-2 6c-1.5-1.5-2-3.5-2-6s.5-4.5 2-6z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6L8 10L12 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8L6.5 11L12.5 5" />
    </svg>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5l1.85 4.25 4.65.5-3.5 3.1 1.05 4.55L8 11.35 3.95 13.9 5 9.35 1.5 6.25l4.65-.5L8 1.5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M8 1.5l1.85 4.25 4.65.5-3.5 3.1 1.05 4.55L8 11.35 3.95 13.9 5 9.35 1.5 6.25l4.65-.5L8 1.5z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}
