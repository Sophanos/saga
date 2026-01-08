import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  inline,
  arrow,
  autoUpdate,
  FloatingPortal,
  FloatingArrow,
  type ReferenceType,
} from '@floating-ui/react';

export type ContextScope = 'page' | 'chapter' | 'project' | 'all';

export interface AIQuickAction {
  id: string;
  label: string;
  icon: string;
  category: 'suggested' | 'edit' | 'write' | 'generate';
  keywords?: string[];
  submenu?: { id: string; label: string }[];
}

export interface SelectionVirtualElement {
  getBoundingClientRect: () => DOMRect;
  getClientRects: () => DOMRectList | DOMRect[];
}

interface AICommandPaletteProps {
  selectedText?: string;
  virtualElement?: SelectionVirtualElement | null;
  onClose: () => void;
  onSubmit: (prompt: string, action?: AIQuickAction, submenuId?: string) => void;
}

const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'direct', label: 'Direct' },
  { id: 'confident', label: 'Confident' },
  { id: 'friendly', label: 'Friendly' },
];

const TRANSLATE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'German' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'it', label: 'Italian' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'ja', label: 'Japanese' },
  { id: 'zh', label: 'Chinese' },
];

export const AI_QUICK_ACTIONS: AIQuickAction[] = [
  { id: 'improve', label: 'Improve writing', icon: '✨', category: 'suggested', keywords: ['improve', 'better', 'enhance'] },
  { id: 'proofread', label: 'Proofread', icon: '✓', category: 'suggested', keywords: ['proofread', 'check', 'grammar', 'spelling'] },
  { id: 'translate', label: 'Translate to...', icon: 'Aあ', category: 'suggested', submenu: TRANSLATE_OPTIONS },
  { id: 'expand', label: 'Expand', icon: '≡', category: 'edit', keywords: ['expand', 'longer', 'elaborate', 'detail'] },
  { id: 'shorten', label: 'Make shorter', icon: '—', category: 'edit', keywords: ['shorten', 'shorter', 'concise', 'brief'] },
  { id: 'tone', label: 'Change tone...', icon: '✎', category: 'edit', submenu: TONE_OPTIONS },
  { id: 'simplify', label: 'Simplify language', icon: '◇', category: 'edit', keywords: ['simplify', 'simple', 'easy'] },
  { id: 'edit-selection', label: 'Edit selection...', icon: '✐', category: 'edit', keywords: ['edit', 'modify', 'change'] },
  { id: 'continue', label: 'Continue writing', icon: '✍', category: 'write', keywords: ['continue', 'next', 'more'] },
  { id: 'dialogue', label: 'Add dialogue', icon: '"', category: 'write', keywords: ['dialogue', 'conversation', 'speech'] },
  { id: 'describe', label: 'Add description', icon: '☼', category: 'write', keywords: ['describe', 'description', 'detail'] },
  { id: 'brainstorm', label: 'Brainstorm ideas', icon: '◉', category: 'write', keywords: ['brainstorm', 'ideas', 'suggest'] },
];

const CATEGORY_LABELS: Record<string, string> = {
  suggested: 'Suggested',
  edit: 'Edit',
  write: 'Write',
  generate: 'Generate',
};

const SCOPE_LABELS: Record<ContextScope, string> = {
  page: 'Current Page',
  chapter: 'Chapter',
  project: 'Project',
  all: 'All Sources',
};

export function AICommandPalette({
  selectedText,
  virtualElement,
  onClose,
  onSubmit,
}: AICommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ContextScope>('page');
  const [showScopeDropdown, setShowScopeDropdown] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open: true,
    placement: 'bottom-start',
    middleware: [
      inline(),
      offset(4),
      shift({ padding: 16 }),
      arrow({ element: arrowRef, padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (virtualElement) refs.setReference(virtualElement as ReferenceType);
  }, [virtualElement, refs]);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const filteredActions = useMemo(() => {
    if (!query) return AI_QUICK_ACTIONS;
    const lower = query.toLowerCase();
    return AI_QUICK_ACTIONS.filter(
      (action) =>
        action.label.toLowerCase().includes(lower) ||
        action.keywords?.some((k) => k.includes(lower))
    );
  }, [query]);

  const groupedActions = useMemo(() => {
    const groups: Record<string, AIQuickAction[]> = {};
    for (const action of filteredActions) {
      if (!groups[action.category]) groups[action.category] = [];
      groups[action.category].push(action);
    }
    return groups;
  }, [filteredActions]);

  const handleSubmit = useCallback(() => {
    if (query.trim()) onSubmit(query.trim());
  }, [query, onSubmit]);

  const handleActionClick = useCallback(
    (action: AIQuickAction, submenuId?: string) => {
      if (action.submenu && !submenuId) {
        setActiveSubmenu(action.id);
        return;
      }
      onSubmit('', action, submenuId);
    },
    [onSubmit]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSubmenu) setActiveSubmenu(null);
        else if (query) setQuery('');
        else onClose();
        e.preventDefault();
      } else if (e.key === 'Enter' && !e.shiftKey && query.trim()) {
        handleSubmit();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [query, activeSubmenu, handleSubmit, onClose]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const floating = refs.floating.current;
      if (floating && !floating.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, refs.floating]);

  const hasSelection = selectedText && selectedText.length > 0;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        className={`ai-command-palette ${isVisible ? 'ai-command-palette--visible' : ''}`}
        style={floatingStyles}
      >
        <FloatingArrow
          ref={arrowRef}
          context={context}
          width={14}
          height={7}
          tipRadius={2}
          style={{ fill: 'var(--color-bg-elevated, #fff)', filter: 'drop-shadow(0 -1px 0 var(--color-border, #e5e7eb))' }}
        />

        <div className="ai-palette-input-row">
          <div className="ai-palette-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 8.5C8.5 7 11 6.5 12 6.5C13 6.5 15.5 7 17 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="12" r="1.5" fill="currentColor" />
              <path d="M14 11C14 11 15 10.5 16 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10 17C11 18 13 18 14 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <input
            ref={inputRef}
            type="text"
            className="ai-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={hasSelection ? 'Ask AI about selection...' : 'Ask AI something...'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit();
                e.preventDefault();
              }
            }}
          />

          <div className="ai-palette-scope-wrapper">
            <button className="ai-palette-scope-btn" onClick={() => setShowScopeDropdown(!showScopeDropdown)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
              </svg>
              <span>{SCOPE_LABELS[scope]}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showScopeDropdown && (
              <div className="ai-palette-scope-dropdown">
                {(Object.keys(SCOPE_LABELS) as ContextScope[]).map((s) => (
                  <button
                    key={s}
                    className={`ai-palette-scope-item ${scope === s ? 'active' : ''}`}
                    onClick={() => { setScope(s); setShowScopeDropdown(false); }}
                  >
                    {SCOPE_LABELS[s]}
                    {scope === s && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="ai-palette-icon-btn" title="Mention"><span>@</span></button>

          <button
            className={`ai-palette-send-btn ${query.trim() ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!query.trim()}
            title="Send (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {!query && (
          <div className="ai-palette-actions">
            {Object.entries(groupedActions).map(([category, actions]) => (
              <div key={category} className="ai-palette-category">
                <div className="ai-palette-category-label">{CATEGORY_LABELS[category]}</div>
                {actions.map((action) => (
                  <div key={action.id} className="ai-palette-action-wrapper">
                    <button
                      className={`ai-palette-action ${hoveredAction === action.id ? 'hovered' : ''}`}
                      onMouseEnter={() => { setHoveredAction(action.id); if (action.submenu) setActiveSubmenu(action.id); }}
                      onMouseLeave={() => { if (!action.submenu) setHoveredAction(null); }}
                      onClick={() => handleActionClick(action)}
                    >
                      <span className="ai-palette-action-icon">{action.icon}</span>
                      <span className="ai-palette-action-label">{action.label}</span>
                      {action.submenu && (
                        <svg className="ai-palette-action-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      )}
                    </button>
                    {action.submenu && activeSubmenu === action.id && (
                      <div
                        className="ai-palette-submenu"
                        onMouseEnter={() => setHoveredAction(action.id)}
                        onMouseLeave={() => { setHoveredAction(null); setActiveSubmenu(null); }}
                      >
                        {action.submenu.map((item, idx) => (
                          <button key={item.id} className="ai-palette-submenu-item" onClick={() => handleActionClick(action, item.id)}>
                            {item.label}
                            {idx === 0 && <span className="ai-palette-shortcut">↵</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <style>{`
          .ai-command-palette {
            z-index: 1000;
            width: 420px;
            background: var(--color-bg-elevated, #fff);
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: var(--radius-xl, 16px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
            overflow: visible;
            font-family: var(--font-sans, system-ui);
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity 150ms ease-out, transform 150ms ease-out;
          }
          .ai-command-palette--visible { opacity: 1; transform: translateY(0); }
          .ai-palette-input-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--color-border-subtle, #f1f1ef); }
          .ai-palette-avatar { flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--color-bg-surface, #f7f7f5); border: 1px solid var(--color-border, #e8e8e6); border-radius: 50%; color: var(--color-text, #37352f); }
          .ai-palette-input { flex: 1; min-width: 0; border: none; background: transparent; font-size: 15px; color: var(--color-text, #37352f); outline: none; }
          .ai-palette-input::placeholder { color: var(--color-text-ghost, #c7c7c5); }
          .ai-palette-scope-wrapper { position: relative; }
          .ai-palette-scope-btn { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: none; background: transparent; border-radius: var(--radius-md, 8px); font-size: 13px; color: var(--color-text-secondary, #6b6b6b); cursor: pointer; transition: background 0.15s; white-space: nowrap; }
          .ai-palette-scope-btn:hover { background: var(--color-bg-hover, #f1f1ef); }
          .ai-palette-scope-dropdown { position: absolute; top: calc(100% + 4px); right: 0; min-width: 160px; background: var(--color-bg-elevated, #fff); border: 1px solid var(--color-border, #e5e7eb); border-radius: var(--radius-lg, 12px); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); z-index: 10; padding: 4px; }
          .ai-palette-scope-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 12px; border: none; background: transparent; border-radius: var(--radius-md, 8px); font-size: 13px; color: var(--color-text, #37352f); cursor: pointer; text-align: left; }
          .ai-palette-scope-item:hover { background: var(--color-bg-hover, #f1f1ef); }
          .ai-palette-scope-item.active { color: var(--color-accent, #2eaadc); }
          .ai-palette-icon-btn { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; border-radius: var(--radius-md, 8px); font-size: 16px; font-weight: 500; color: var(--color-text-muted, #9b9a97); cursor: pointer; }
          .ai-palette-icon-btn:hover { background: var(--color-bg-hover, #f1f1ef); color: var(--color-text-secondary, #6b6b6b); }
          .ai-palette-send-btn { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: var(--color-bg-hover, #f1f1ef); border-radius: 50%; color: var(--color-text-muted, #9b9a97); cursor: pointer; transition: all 0.15s; }
          .ai-palette-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .ai-palette-send-btn.active { background: var(--color-accent, #2eaadc); color: #fff; }
          .ai-palette-send-btn.active:hover { background: var(--color-accent-hover, #0077b5); }
          .ai-palette-actions { max-height: 360px; overflow-y: auto; padding: 4px 0; }
          .ai-palette-category { padding: 4px 0; }
          .ai-palette-category-label { padding: 8px 16px 4px; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-muted, #9b9a97); }
          .ai-palette-action-wrapper { position: relative; }
          .ai-palette-action { display: flex; align-items: center; width: 100%; padding: 8px 16px; border: none; background: transparent; font-size: 14px; color: var(--color-text, #37352f); cursor: pointer; text-align: left; gap: 12px; transition: background 0.1s; }
          .ai-palette-action:hover, .ai-palette-action.hovered { background: var(--color-bg-hover, #f1f1ef); }
          .ai-palette-action-icon { width: 20px; text-align: center; font-size: 15px; color: var(--color-text-secondary, #6b6b6b); }
          .ai-palette-action-label { flex: 1; }
          .ai-palette-action-arrow { color: var(--color-text-muted, #9b9a97); }
          .ai-palette-submenu { position: absolute; left: calc(100% + 4px); top: 0; min-width: 160px; background: var(--color-bg-elevated, #fff); border: 1px solid var(--color-border, #e5e7eb); border-radius: var(--radius-lg, 12px); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); z-index: 20; padding: 4px; }
          .ai-palette-submenu-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 12px; border: none; background: transparent; border-radius: var(--radius-md, 8px); font-size: 14px; color: var(--color-text, #37352f); cursor: pointer; text-align: left; }
          .ai-palette-submenu-item:hover { background: var(--color-bg-hover, #f1f1ef); }
          .ai-palette-shortcut { font-size: 12px; color: var(--color-text-muted, #9b9a97); opacity: 0.7; }
          .ai-palette-actions::-webkit-scrollbar { width: 6px; }
          .ai-palette-actions::-webkit-scrollbar-track { background: transparent; }
          .ai-palette-actions::-webkit-scrollbar-thumb { background: var(--color-border, #e5e7eb); border-radius: 3px; }
        `}</style>
      </div>
    </FloatingPortal>
  );
}

export default AICommandPalette;
