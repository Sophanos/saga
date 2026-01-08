import { useState } from 'react';

// Match AI panel quick actions
export type QuickActionType = 'search' | 'lint' | 'continue' | 'character' | 'brainstorm' | 'arc';

interface QuickAction {
  id: QuickActionType;
  label: string;
  icon: React.ReactNode;
  description?: string;
  badge?: string;
}

interface QuickActionsProps {
  onAction: (action: QuickActionType) => void;
  className?: string;
}

export function QuickActions({ onAction, className = '' }: QuickActionsProps) {
  const [showMore, setShowMore] = useState(false);

  // Match the AI panel's QUICK_ACTIONS
  const primaryActions: QuickAction[] = [
    { id: 'search', label: 'Search your world', icon: <SearchIcon />, description: 'Find anything in your story' },
    { id: 'continue', label: 'Continue this scene', icon: <WriteIcon />, description: 'AI continues your writing' },
    { id: 'character', label: 'Generate character', icon: <CharacterIcon />, description: 'Create a new character', badge: 'New' },
    { id: 'brainstorm', label: 'Brainstorm ideas', icon: <BrainstormIcon />, description: 'Explore story possibilities' },
  ];

  const moreActions: QuickAction[] = [
    { id: 'lint', label: 'Find inconsistencies', icon: <LintIcon />, description: 'Check for plot holes and errors' },
    { id: 'arc', label: 'Analyze story arc', icon: <ArcIcon />, description: 'Review character and plot arcs' },
  ];

  return (
    <div className={`quick-actions ${className}`}>
      <span className="quick-actions-label">Get started with</span>

      <div className="quick-actions-buttons">
        {primaryActions.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            onClick={() => onAction(action.id)}
          />
        ))}

        <div className="quick-actions-more-container">
          <button
            className={`quick-action-more ${showMore ? 'quick-action-more--active' : ''}`}
            onClick={() => setShowMore(!showMore)}
            aria-label="More actions"
          >
            <MoreIcon />
          </button>

          {showMore && (
            <>
              <div className="quick-actions-more-backdrop" onClick={() => setShowMore(false)} />
              <div className="quick-actions-more-menu">
                {moreActions.map((action) => (
                  <button
                    key={action.id}
                    className="quick-actions-more-item"
                    onClick={() => {
                      onAction(action.id);
                      setShowMore(false);
                    }}
                  >
                    <span className="quick-actions-more-icon">{action.icon}</span>
                    <div className="quick-actions-more-content">
                      <span className="quick-actions-more-label">{action.label}</span>
                      {action.description && (
                        <span className="quick-actions-more-desc">{action.description}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .quick-actions {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding: var(--space-6) var(--space-4);
        }

        .quick-actions-label {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        .quick-actions-buttons {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .quick-action-more-container {
          position: relative;
        }

        .quick-action-more {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .quick-action-more:hover,
        .quick-action-more--active {
          background: var(--color-bg-hover);
          border-color: var(--color-border);
          color: var(--color-text-secondary);
        }

        .quick-action-more svg {
          width: 16px;
          height: 16px;
        }

        .quick-actions-more-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
        }

        .quick-actions-more-menu {
          position: absolute;
          bottom: calc(100% + var(--space-2));
          left: 50%;
          transform: translateX(-50%);
          min-width: 200px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-1);
          z-index: 101;
          box-shadow: var(--shadow-lg);
          animation: menuFadeUp var(--duration-fast) var(--ease-out);
        }

        @keyframes menuFadeUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .quick-actions-more-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-2-5) var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
          text-align: left;
        }

        .quick-actions-more-item:hover {
          background: var(--color-bg-hover);
        }

        .quick-actions-more-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          color: var(--color-text-muted);
        }

        .quick-actions-more-icon svg {
          width: 18px;
          height: 18px;
        }

        .quick-actions-more-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-0-5);
        }

        .quick-actions-more-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--color-text);
        }

        .quick-actions-more-desc {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}

interface QuickActionButtonProps {
  action: QuickAction;
  onClick: () => void;
}

function QuickActionButton({ action, onClick }: QuickActionButtonProps) {
  return (
    <button className="quick-action-button" onClick={onClick}>
      <span className="quick-action-icon">{action.icon}</span>
      <span className="quick-action-label">{action.label}</span>
      {action.badge && <span className="quick-action-badge">{action.badge}</span>}

      <style>{`
        .quick-action-button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-out);
        }

        .quick-action-button:hover {
          background: var(--color-bg-hover);
          border-color: var(--color-text-ghost);
          transform: translateY(-1px);
        }

        .quick-action-button:active {
          transform: translateY(0);
        }

        .quick-action-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
        }

        .quick-action-icon svg {
          width: 16px;
          height: 16px;
        }

        .quick-action-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        .quick-action-badge {
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          color: #fff;
          background: var(--color-accent);
          padding: 1px 6px;
          border-radius: var(--radius-sm);
        }
      `}</style>
    </button>
  );
}

// Icons - matching AI panel actions
function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function WriteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13h10M3 10l7-7 3 3-7 7H3v-3z" />
    </svg>
  );
}

function CharacterIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5" r="3" />
      <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" />
      <path d="M12 3v4M10 5h4" />
    </svg>
  );
}

function BrainstormIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v1M8 13v1M2 8h1M13 8h1M4 4l.7.7M11.3 11.3l.7.7M12 4l-.7.7M4.7 11.3l-.7.7" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

function LintIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2L2 13h12L8 2z" />
      <path d="M8 6v3M8 11v.5" />
    </svg>
  );
}

function ArcIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12l3-4 3 2 4-6 2 3" />
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
