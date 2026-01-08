import { useState, useRef, useEffect } from 'react';

type FontStyle = 'default' | 'serif' | 'mono';

interface MoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  fontStyle?: FontStyle;
  onFontStyleChange?: (style: FontStyle) => void;
  isOffline?: boolean;
  onToggleOffline?: () => void;
  isSmallText?: boolean;
  onToggleSmallText?: () => void;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
  isLocked?: boolean;
  onToggleLocked?: () => void;
  onCopyLink?: () => void;
  onDuplicate?: () => void;
  onMoveTo?: () => void;
  onMoveToTrash?: () => void;
  onSuggestChanges?: () => void;
  onTranslate?: () => void;
  onUndo?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onVersionHistory?: () => void;
}

export function MoreMenu({
  isOpen,
  onClose,
  fontStyle = 'default',
  onFontStyleChange,
  isOffline = false,
  onToggleOffline,
  isSmallText = false,
  onToggleSmallText,
  isFullWidth = false,
  onToggleFullWidth,
  isLocked = false,
  onToggleLocked,
  onCopyLink,
  onDuplicate,
  onMoveTo,
  onMoveToTrash,
  onSuggestChanges,
  onTranslate,
  onUndo,
  onImport,
  onExport,
  onVersionHistory,
}: MoreMenuProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fontStyles: { value: FontStyle; label: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'serif', label: 'Serif' },
    { value: 'mono', label: 'Mono' },
  ];

  const actions = [
    { id: 'copy-link', label: 'Copy link', shortcut: '⌘L', icon: <LinkIcon />, onClick: onCopyLink },
    { id: 'duplicate', label: 'Duplicate', shortcut: '⌘D', icon: <CopyIcon />, onClick: onDuplicate },
    { id: 'move-to', label: 'Move to', shortcut: '⌘⇧P', icon: <MoveIcon />, onClick: onMoveTo },
    { id: 'trash', label: 'Move to trash', icon: <TrashIcon />, onClick: onMoveToTrash, danger: true },
  ];

  const toggles = [
    { id: 'offline', label: 'Available offline', checked: isOffline, onToggle: onToggleOffline },
    { id: 'small-text', label: 'Small text', checked: isSmallText, onToggle: onToggleSmallText },
    { id: 'full-width', label: 'Full width', checked: isFullWidth, onToggle: onToggleFullWidth },
  ];

  const pageActions = [
    { id: 'customize', label: 'Customize page', icon: <SettingsIcon /> },
    { id: 'lock', label: 'Lock page', checked: isLocked, onToggle: onToggleLocked },
  ];

  const editActions = [
    { id: 'suggest', label: 'Suggest changes', icon: <EditIcon />, onClick: onSuggestChanges },
    { id: 'translate', label: 'Translate', icon: <TranslateIcon />, onClick: onTranslate, hasSubmenu: true },
  ];

  const historyActions = [
    { id: 'undo', label: 'Undo', shortcut: '⌘Z', icon: <UndoIcon />, onClick: onUndo },
    { id: 'import', label: 'Import', icon: <ImportIcon />, onClick: onImport },
    { id: 'export', label: 'Export', icon: <ExportIcon />, onClick: onExport },
    { id: 'version', label: 'Version history', icon: <HistoryIcon />, onClick: onVersionHistory },
  ];

  const filterItems = (items: any[]) => {
    if (!search) return items;
    return items.filter(item =>
      item.label.toLowerCase().includes(search.toLowerCase())
    );
  };

  return (
    <>
      <div className="more-menu-backdrop" onClick={onClose} />
      <div className="more-menu">
        <div className="more-menu-search">
          <SearchIcon />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!search && (
          <div className="more-menu-fonts">
            {fontStyles.map(({ value, label }) => (
              <button
                key={value}
                className={`font-style-button ${fontStyle === value ? 'font-style-button--active' : ''}`}
                onClick={() => onFontStyleChange?.(value)}
              >
                <span className={`font-preview font-preview--${value}`}>Ag</span>
                <span className="font-label">{label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="more-menu-section">
          {filterItems(actions).map((action) => (
            <MenuItem key={action.id} {...action} />
          ))}
        </div>

        {!search && (
          <div className="more-menu-section">
            {toggles.map((toggle) => (
              <ToggleItem key={toggle.id} {...toggle} />
            ))}
          </div>
        )}

        <div className="more-menu-section">
          {filterItems(pageActions).map((action) => (
            'onToggle' in action ? (
              <ToggleItem key={action.id} {...action} />
            ) : (
              <MenuItem key={action.id} {...action} />
            )
          ))}
        </div>

        <div className="more-menu-section">
          {filterItems(editActions).map((action) => (
            <MenuItem key={action.id} {...action} />
          ))}
        </div>

        <div className="more-menu-section">
          {filterItems(historyActions).map((action) => (
            <MenuItem key={action.id} {...action} />
          ))}
        </div>

        <style>{`
          .more-menu-backdrop {
            position: fixed;
            inset: 0;
            z-index: 200;
          }

          .more-menu {
            position: absolute;
            top: calc(var(--header-height) + var(--space-1));
            right: var(--space-4);
            width: var(--menu-width);
            max-height: calc(100vh - var(--header-height) - var(--space-8));
            overflow-y: auto;
            background: var(--color-bg-elevated);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-lg);
            padding: var(--space-2);
            z-index: 201;
            box-shadow: var(--shadow-lg);
            animation: menuSlideIn var(--duration-normal) var(--ease-out);
          }

          @keyframes menuSlideIn {
            from {
              opacity: 0;
              transform: translateY(-8px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .more-menu-search {
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-2) var(--space-2-5);
            margin-bottom: var(--space-2);
            background: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
          }

          .more-menu-search svg {
            width: 16px;
            height: 16px;
            color: var(--color-text-muted);
            flex-shrink: 0;
          }

          .more-menu-search input {
            flex: 1;
            font-size: var(--text-sm);
            color: var(--color-text);
            background: transparent;
            border: none;
            outline: none;
          }

          .more-menu-search input::placeholder {
            color: var(--color-text-muted);
          }

          .more-menu-fonts {
            display: flex;
            gap: var(--space-2);
            padding: var(--space-2);
            margin-bottom: var(--space-2);
            border-bottom: 1px solid var(--color-border-subtle);
          }

          .font-style-button {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--space-1);
            padding: var(--space-2);
            background: transparent;
            border: 1px solid transparent;
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--duration-fast) var(--ease-out);
          }

          .font-style-button:hover {
            background: var(--color-bg-hover);
          }

          .font-style-button--active {
            border-color: var(--color-accent);
            background: var(--color-accent-subtle);
          }

          .font-preview {
            font-size: var(--text-xl);
            font-weight: var(--font-medium);
            color: var(--color-accent);
          }

          .font-preview--default {
            font-family: var(--font-sans);
          }

          .font-preview--serif {
            font-family: var(--font-serif);
          }

          .font-preview--mono {
            font-family: var(--font-mono);
          }

          .font-label {
            font-size: var(--text-xs);
            color: var(--color-text-muted);
          }

          .more-menu-section {
            padding: var(--space-1) 0;
            border-bottom: 1px solid var(--color-border-subtle);
          }

          .more-menu-section:last-child {
            border-bottom: none;
          }
        `}</style>
      </div>
    </>
  );
}

interface MenuItemProps {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  danger?: boolean;
  hasSubmenu?: boolean;
}

function MenuItem({ label, icon, shortcut, onClick, danger, hasSubmenu }: MenuItemProps) {
  return (
    <button className={`menu-item ${danger ? 'menu-item--danger' : ''}`} onClick={onClick}>
      {icon && <span className="menu-item-icon">{icon}</span>}
      <span className="menu-item-label">{label}</span>
      {shortcut && <span className="menu-item-shortcut">{shortcut}</span>}
      {hasSubmenu && <ChevronRightIcon />}

      <style>{`
        .menu-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-2) var(--space-2-5);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
          text-align: left;
        }

        .menu-item:hover {
          background: var(--color-bg-hover);
          color: var(--color-text);
        }

        .menu-item--danger:hover {
          background: rgba(248, 113, 113, 0.1);
          color: var(--color-red);
        }

        .menu-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
        }

        .menu-item-icon svg {
          width: 16px;
          height: 16px;
        }

        .menu-item-label {
          flex: 1;
        }

        .menu-item-shortcut {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }
      `}</style>
    </button>
  );
}

interface ToggleItemProps {
  id: string;
  label: string;
  checked?: boolean;
  onToggle?: () => void;
}

function ToggleItem({ label, checked = false, onToggle }: ToggleItemProps) {
  return (
    <button className="toggle-item" onClick={onToggle}>
      <span className="toggle-item-label">{label}</span>
      <div className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}>
        <div className="toggle-knob" />
      </div>

      <style>{`
        .toggle-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: var(--space-2) var(--space-2-5);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .toggle-item:hover {
          background: var(--color-bg-hover);
          color: var(--color-text);
        }

        .toggle-item-label {
          flex: 1;
          text-align: left;
        }

        .toggle-switch {
          width: 36px;
          height: 20px;
          background: var(--color-bg-active);
          border-radius: var(--radius-full);
          padding: 2px;
          transition: background var(--duration-fast) var(--ease-out);
        }

        .toggle-switch--on {
          background: var(--color-accent);
        }

        .toggle-knob {
          width: 16px;
          height: 16px;
          background: var(--color-text);
          border-radius: var(--radius-full);
          transition: transform var(--duration-fast) var(--ease-spring);
        }

        .toggle-switch--on .toggle-knob {
          transform: translateX(16px);
        }
      `}</style>
    </button>
  );
}

// Icons
function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6.5 9.5L9.5 6.5M7 11L5 13a2 2 0 01-2.83-2.83L4 8M9 5l2-2a2 2 0 012.83 2.83L12 8" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="8" rx="1" />
      <path d="M3 11V3a1 1 0 011-1h8" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 8L10 4M14 8L10 12M14 8H2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4M6.5 7v5M9.5 7v5M3.5 4l1 10a1 1 0 001 1h5a1 1 0 001-1l1-10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M14.66 4L12.93 5M3.07 11l-1.73 1M14.66 12l-1.73-1M3.07 5l-1.73-1M15 8h-2M3 8H1" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 3.5l3 3M2 11.5V14h2.5L13 5.5l-3-3L2 11.5z" />
    </svg>
  );
}

function TranslateIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h7M5.5 2v2M7.5 4c-.5 2-2 4-5 5.5M3.5 4c.5 2.5 2.5 4.5 5 5" />
      <path d="M9 14l2-5 2 5M9.5 12.5h3" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6h8a4 4 0 110 8H6M2 6l3-3M2 6l3 3" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2 13h12" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V2M4.5 5.5L8 2l3.5 3.5M2 13h12" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l2.5 2.5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
      <path d="M6 4L10 8L6 12" />
    </svg>
  );
}
