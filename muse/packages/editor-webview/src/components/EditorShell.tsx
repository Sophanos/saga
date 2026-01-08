import { useState, useCallback, useEffect } from 'react';
import { TabBar, type Tab } from './TabBar';
import { PageHeader } from './PageHeader';
import { MoreMenu } from './MoreMenu';
import { QuickActions, type QuickActionType } from './QuickActions';
import { Editor } from './Editor';

type FontStyle = 'default' | 'serif' | 'mono';
type PrivacyLevel = 'private' | 'workspace' | 'public';

interface DocumentState {
  id: string;
  title: string;
  content: string;
  isDirty: boolean;
}

interface EditorShellProps {
  initialDocuments?: DocumentState[];
  onDocumentChange?: (doc: DocumentState) => void;
  onQuickAction?: (action: QuickActionType) => void;
  onShare?: () => void;
  hideQuickActions?: boolean;
  colorScheme?: 'light' | 'dark';
  /** When true, adds left padding to TabBar for sidebar toggle button */
  sidebarCollapsed?: boolean;
}

const CSS_TOKENS = `
:root {
  --space-0: 0;
  --space-0-5: 2px;
  --space-1: 4px;
  --space-1-5: 6px;
  --space-2: 8px;
  --space-2-5: 10px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, 'Apple Color Emoji', Arial, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-serif: Lyon-Text, Georgia, ui-serif, serif;
  --font-mono: iawriter-mono, Nitti, Menlo, Courier, monospace;

  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-lg: 17px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;

  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;

  --header-height: 45px;
  --tab-bar-height: 45px;
  --content-max-width: 708px;
  --menu-width: 265px;

  --color-purple: #a78bfa;
  --color-green: #34d399;
  --color-amber: #fbbf24;
  --color-red: #f87171;
  --color-cyan: #22d3ee;
}

:root {
  --color-bg-app: #ffffff;
  --color-bg-surface: #f7f7f5;
  --color-bg-elevated: #ffffff;
  --color-bg-hover: #f1f1ef;
  --color-bg-active: #e8e8e6;

  --color-border: #e8e8e6;
  --color-border-subtle: #f1f1ef;

  --color-text: #37352f;
  --color-text-secondary: #6b6b6b;
  --color-text-muted: #9b9a97;
  --color-text-ghost: #c7c7c5;

  --color-accent: #2eaadc;
  --color-accent-hover: #0077b5;
  --color-accent-subtle: rgba(46, 170, 220, 0.1);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-app: #191919;
    --color-bg-surface: #202020;
    --color-bg-elevated: #252525;
    --color-bg-hover: #2f2f2f;
    --color-bg-active: #373737;

    --color-border: #2d2d2d;
    --color-border-subtle: #252525;

    --color-text: rgba(255, 255, 255, 0.81);
    --color-text-secondary: rgba(255, 255, 255, 0.61);
    --color-text-muted: rgba(255, 255, 255, 0.36);
    --color-text-ghost: rgba(255, 255, 255, 0.24);

    --color-accent: #529cca;
    --color-accent-hover: #2eaadc;
    --color-accent-subtle: rgba(82, 156, 202, 0.15);

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
`;

// Extract plain text from HTML for preview using DOM parser
function extractPreviewText(html: string, maxLength = 280): string {
  if (!html || html === '<p></p>') return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Process lists to add markers
    doc.querySelectorAll('li').forEach((li) => {
      const parent = li.parentElement;
      const isOrdered = parent?.tagName === 'OL';
      const isTaskList = li.hasAttribute('data-type') && li.getAttribute('data-type') === 'taskItem';

      let prefix = '• ';
      if (isOrdered) {
        const items = Array.from(parent?.children || []);
        prefix = `${items.indexOf(li) + 1}. `;
      } else if (isTaskList) {
        const isChecked = li.getAttribute('data-checked') === 'true';
        prefix = isChecked ? '☑ ' : '☐ ';
      }

      li.textContent = prefix + (li.textContent || '');
    });

    // Process code blocks
    doc.querySelectorAll('pre, code').forEach((el) => {
      if (el.tagName === 'PRE') {
        el.textContent = `[code] ${el.textContent}`;
      }
    });

    // Get text and clean up whitespace
    let text = doc.body.textContent || '';
    text = text
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > maxLength) {
      // Cut at word boundary
      const truncated = text.slice(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      return (lastSpace > maxLength * 0.7 ? truncated.slice(0, lastSpace) : truncated) + '...';
    }

    return text;
  } catch {
    // Fallback: simple regex strip
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }
}

export function EditorShell({
  initialDocuments = [{ id: '1', title: '', content: '', isDirty: false }],
  onDocumentChange,
  onQuickAction,
  onShare,
  hideQuickActions = false,
  sidebarCollapsed = false,
}: EditorShellProps) {
  useEffect(() => {
    const styleId = 'editor-webview-tokens';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = CSS_TOKENS;
      document.head.appendChild(style);
    }
  }, []);

  const [documents, setDocuments] = useState<DocumentState[]>(initialDocuments);
  const [activeDocId, setActiveDocId] = useState(initialDocuments[0]?.id ?? '1');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [fontStyle, setFontStyle] = useState<FontStyle>('default');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('private');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSmallText, setIsSmallText] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [navHistory, setNavHistory] = useState<string[]>([activeDocId]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const activeDoc = documents.find((d) => d.id === activeDocId);

  // Build tabs with content preview for hover tooltip
  const tabs: Tab[] = documents.map((d) => ({
    id: d.id,
    title: d.title || 'Untitled',
    content: extractPreviewText(d.content),
    isDirty: d.isDirty,
  }));

  const navigateTo = useCallback((docId: string) => {
    setActiveDocId(docId);
    setNavHistory((prev) => [...prev.slice(0, historyIndex + 1), docId]);
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleTabSelect = useCallback((id: string) => {
    navigateTo(id);
  }, [navigateTo]);

  const handleTabClose = useCallback((id: string) => {
    if (documents.length === 1) return;
    const newDocs = documents.filter((d) => d.id !== id);
    setDocuments(newDocs);
    if (activeDocId === id) {
      setActiveDocId(newDocs[0].id);
    }
  }, [documents, activeDocId]);

  const handleNewTab = useCallback(() => {
    const newId = `doc-${Date.now()}`;
    const newDoc: DocumentState = {
      id: newId,
      title: '',
      content: '',
      isDirty: false,
    };
    setDocuments((prev) => [...prev, newDoc]);
    navigateTo(newId);
  }, [navigateTo]);

  const handleNavigateBack = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setActiveDocId(navHistory[historyIndex - 1]);
    }
  }, [historyIndex, navHistory]);

  const handleNavigateForward = useCallback(() => {
    if (historyIndex < navHistory.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setActiveDocId(navHistory[historyIndex + 1]);
    }
  }, [historyIndex, navHistory]);

  const handleTitleChange = useCallback((title: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId ? { ...d, title, isDirty: true } : d
      )
    );
    if (activeDoc) {
      onDocumentChange?.({ ...activeDoc, title, isDirty: true });
    }
  }, [activeDocId, activeDoc, onDocumentChange]);

  const handleContentChange = useCallback((content: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDocId ? { ...d, content, isDirty: true } : d
      )
    );
    if (activeDoc) {
      onDocumentChange?.({ ...activeDoc, content, isDirty: true });
    }
  }, [activeDocId, activeDoc, onDocumentChange]);

  const handleQuickAction = useCallback((action: QuickActionType) => {
    onQuickAction?.(action);
  }, [onQuickAction]);

  const isEmpty = !activeDoc?.content || activeDoc.content === '<p></p>';

  return (
    <div className="editor-shell">
      <TabBar
        tabs={tabs}
        activeTabId={activeDocId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onNavigateBack={handleNavigateBack}
        onNavigateForward={handleNavigateForward}
        canGoBack={historyIndex > 0}
        canGoForward={historyIndex < navHistory.length - 1}
        sidebarCollapsed={sidebarCollapsed}
      />

      <PageHeader
        title={activeDoc?.title || 'Untitled'}
        onTitleChange={handleTitleChange}
        privacyLevel={privacyLevel}
        onPrivacyChange={setPrivacyLevel}
        isFavorite={isFavorite}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
        onShare={onShare}
        onMoreClick={() => setShowMoreMenu(!showMoreMenu)}
        showMoreMenu={showMoreMenu}
      />

      <MoreMenu
        isOpen={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        fontStyle={fontStyle}
        onFontStyleChange={setFontStyle}
        isOffline={isOffline}
        onToggleOffline={() => setIsOffline(!isOffline)}
        isSmallText={isSmallText}
        onToggleSmallText={() => setIsSmallText(!isSmallText)}
        isFullWidth={isFullWidth}
        onToggleFullWidth={() => setIsFullWidth(!isFullWidth)}
        isLocked={isLocked}
        onToggleLocked={() => setIsLocked(!isLocked)}
        onCopyLink={() => navigator.clipboard.writeText(window.location.href)}
        onDuplicate={() => {
          if (activeDoc) {
            const newId = `doc-${Date.now()}`;
            const newDoc: DocumentState = {
              id: newId,
              title: `${activeDoc.title} (copy)`,
              content: activeDoc.content,
              isDirty: true,
            };
            setDocuments((prev) => [...prev, newDoc]);
            navigateTo(newId);
          }
        }}
        onUndo={() => {}}
      />

      <main className="editor-shell-main">
        {/* Key forces remount on tab switch to reset Editor's internal state */}
        <Editor
          key={activeDocId}
          title={activeDoc?.title ?? ''}
          content={activeDoc?.content ?? ''}
          onTitleChange={handleTitleChange}
          onChange={handleContentChange}
          fontStyle={fontStyle}
          isSmallText={isSmallText}
          isFullWidth={isFullWidth}
          editable={!isLocked}
          showTitle={true}
          autoFocus
        />

        {isEmpty && !hideQuickActions && (
          <QuickActions
            className="editor-shell-quick-actions"
            onAction={handleQuickAction}
          />
        )}
      </main>

      <style>{`
        .editor-shell {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--color-bg-app);
          position: relative;
        }

        .editor-shell-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          background: var(--color-bg-app);
        }

        .editor-shell-quick-actions {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          max-width: var(--content-max-width);
          width: 100%;
          padding-bottom: var(--space-8);
          background: linear-gradient(to top, var(--color-bg-app) 60%, transparent);
          pointer-events: none;
        }

        .editor-shell-quick-actions > * {
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

export type { DocumentState, EditorShellProps };
