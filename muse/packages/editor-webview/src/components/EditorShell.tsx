import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { TabBar, type Tab } from './TabBar';
import { PageHeader } from './PageHeader';
import { MoreMenu } from './MoreMenu';
import { QuickActions, type QuickActionType } from './QuickActions';
import { Editor } from './Editor';
import { CollaborativeEditor } from './CollaborativeEditor';
import { FlowFocusExtension, TypewriterScrollExtension } from '../extensions';

type FontStyle = 'default' | 'serif' | 'mono';
type PrivacyLevel = 'private' | 'workspace' | 'public';

export interface DocumentState {
  id: string;
  title: string;
  content: string;
  isDirty: boolean;
}

interface CollaborationConfig {
  projectId: string;
  documentId?: string;
  user: { id: string; name: string; avatarUrl?: string };
  authToken?: string | null;
  convexUrl?: string;
}

export interface PendingWriteContentProp {
  suggestionId: string;
  toolCallId: string;
  documentId: string;
  content: string;
  operation: 'replace_selection' | 'insert_at_cursor' | 'append_document';
  selectionText?: string;
}

export interface WriteContentApplyResult {
  applied: boolean;
  documentId?: string;
  snapshotJson?: string;
  summary?: string;
  error?: string;
}

/** Flow mode settings passed from host app to ensure store consistency */
export interface FlowModeSettings {
  enabled: boolean;
  focusLevel: 'none' | 'sentence' | 'paragraph';
  dimOpacity: number;
  typewriterScrolling: boolean;
}

/** Widget status for TabBar indicators */
export type TabWidgetStatus = 'idle' | 'running' | 'ready' | 'failed';

export interface EditorShellProps {
  initialDocuments?: DocumentState[];
  onDocumentChange?: (doc: DocumentState) => void;
  onQuickAction?: (action: QuickActionType) => void;
  onShare?: () => void;
  onVersionHistory?: () => void;
  hideQuickActions?: boolean;
  colorScheme?: 'light' | 'dark';
  /** When true, adds left padding to TabBar for sidebar toggle button */
  sidebarCollapsed?: boolean;
  collaboration?: CollaborationConfig;
  /** Pending write_content suggestion to apply when editor is ready */
  pendingWriteContent?: PendingWriteContentProp | null;
  /** Callback when pending write_content is applied */
  onWriteContentApplied?: (result: WriteContentApplyResult) => void;
  /** When true, hides TabBar and PageHeader for distraction-free editing (flow mode) */
  minimalMode?: boolean;
  /** Flow mode settings - passed from host app to avoid store isolation issues */
  flowSettings?: FlowModeSettings;
  /** Right offset for scroll indicator to account for side panels (AI panel, artifact panel) */
  scrollIndicatorRightOffset?: number;
  /** Widget status per document - for TabBar indicators */
  widgetStatusMap?: Record<string, TabWidgetStatus>;
  /** Notify host app about selection changes */
  onSelectionChange?: (
    selection: { from: number; to: number; text: string } | null,
    documentId: string | null
  ) => void;
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

/* Hide all native scrollbars - using custom scroll indicator */
* {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
`;

interface ApplyInlineWidgetPayload {
  requestId: string;
  executionId: string;
  widgetId: string;
  projectId: string;
  content: string;
  range?: { from: number; to: number };
}

interface ApplyInlineWidgetResult {
  requestId: string;
  executionId: string;
  applied: boolean;
  error?: string;
}

function applyInlineWidgetToEditor(
  editor: any,
  payload: ApplyInlineWidgetPayload
): { applied: boolean; error?: string } {
  if (!editor || editor.isDestroyed) {
    return { applied: false, error: 'Editor is not ready' };
  }

  const safeFrom = Math.max(0, payload.range?.from ?? editor.state.selection.from);
  const safeTo = Math.max(safeFrom, payload.range?.to ?? editor.state.selection.to);

  try {
    editor.commands.setExecutionMarkerProjectId?.(payload.projectId);
    editor
      .chain()
      .focus()
      .insertContentAt({ from: safeFrom, to: safeTo }, payload.content)
      .run();

    const endPos = editor.state.selection.from;
    if (endPos > safeFrom) {
      editor
        .chain()
        .setTextSelection({ from: safeFrom, to: endPos })
        .setExecutionMarker?.({
          executionId: payload.executionId,
          widgetId: payload.widgetId,
          projectId: payload.projectId,
        })
        .run();

      editor.commands.setAppliedHighlight?.({ from: safeFrom, to: endPos });
      editor.commands.setTextSelection(endPos);
    }

    return { applied: true };
  } catch (error) {
    return { applied: false, error: error instanceof Error ? error.message : 'Apply failed' };
  }
}

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
  onVersionHistory,
  hideQuickActions = false,
  sidebarCollapsed = false,
  collaboration,
  pendingWriteContent,
  onWriteContentApplied,
  minimalMode = false,
  flowSettings,
  scrollIndicatorRightOffset = 0,
  widgetStatusMap = {},
  onSelectionChange,
}: EditorShellProps): JSX.Element {
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
  const [readyDocumentId, setReadyDocumentId] = useState<string | null>(null);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorInstanceRef = useRef<any>(null);
  const pendingWriteContentAppliedRef = useRef(false);

  const activeDoc = documents.find((d) => d.id === activeDocId);
  const collaborationDocumentId = collaboration?.documentId ?? activeDocId;
  const shouldUseCollaboration =
    !!collaboration && !!collaboration.projectId && !!collaboration.user && !!collaborationDocumentId;
  const flowEnabled = flowSettings?.enabled ?? false;
  const effectiveFocusLevel = flowEnabled ? flowSettings?.focusLevel ?? 'none' : 'none';
  const effectiveDimOpacity = flowSettings?.dimOpacity ?? 0.3;
  const effectiveTypewriterScrolling = flowEnabled ? flowSettings?.typewriterScrolling ?? false : false;
  const flowExtensions = useMemo(
    () => [
      FlowFocusExtension.configure({
        focusLevel: 'none',
        dimOpacity: 0.3,
      }),
      TypewriterScrollExtension.configure({
        enabled: false,
      }),
    ],
    []
  );

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

  const emitOpenImport = useCallback(() => {
    setShowMoreMenu(false);
    window.dispatchEvent(
      new CustomEvent('editor:open-import', {
        detail: { source: 'more_menu' },
      })
    );
  }, [setShowMoreMenu]);

  const emitOpenExport = useCallback(() => {
    setShowMoreMenu(false);
    window.dispatchEvent(
      new CustomEvent('editor:open-export', {
        detail: { source: 'more_menu' },
      })
    );
  }, [setShowMoreMenu]);

  const isEmpty = !activeDoc?.content || activeDoc.content === '<p></p>';
  const editorReady =
    !!collaborationDocumentId && readyDocumentId === collaborationDocumentId;
  const autosaveStatus = useMemo<'dirty' | 'saving' | 'saved' | 'error'>(() => {
    if (autosaveError) {
      return 'error';
    }
    if (!editorReady) {
      return 'saving';
    }
    return activeDoc?.isDirty ? 'dirty' : 'saved';
  }, [activeDoc?.isDirty, autosaveError, editorReady]);

  const handleEditorReady = useCallback((editor: unknown) => {
    if (!editor) {
      return;
    }
    editorInstanceRef.current = editor;
    setReadyDocumentId(collaborationDocumentId ?? null);
  }, [collaborationDocumentId]);

  const handleSelectionChange = useCallback(
    (selection: { from: number; to: number; text: string } | null) => {
      const documentId = collaborationDocumentId ?? activeDocId ?? null;
      onSelectionChange?.(selection, documentId);
    },
    [activeDocId, collaborationDocumentId, onSelectionChange]
  );

  useEffect(() => {
    const handleApplyInline = (event: Event) => {
      const customEvent = event as CustomEvent<ApplyInlineWidgetPayload>;
      const payload = customEvent.detail;
      if (!payload) return;
      const editor = editorInstanceRef.current;
      const result = applyInlineWidgetToEditor(editor, payload);
      window.dispatchEvent(
        new CustomEvent<ApplyInlineWidgetResult>('widget:apply-inline-result', {
          detail: {
            requestId: payload.requestId,
            executionId: payload.executionId,
            applied: result.applied,
            error: result.error,
          },
        })
      );
    };

    window.addEventListener('widget:apply-inline', handleApplyInline);
    return () => window.removeEventListener('widget:apply-inline', handleApplyInline);
  }, []);

  // Apply pending write_content when editor is ready and document matches
  useEffect(() => {
    if (!pendingWriteContent || pendingWriteContentAppliedRef.current) return;
    if (!editorInstanceRef.current) return;
    if (pendingWriteContent.documentId !== collaborationDocumentId) return;

    const editor = editorInstanceRef.current;
    if (editor.isDestroyed) return;

    pendingWriteContentAppliedRef.current = true;

    const { content, operation } = pendingWriteContent;
    let insertFrom = editor.state.selection.from;
    let summary = '';

    try {
      if (operation === 'replace_selection') {
        const { from, to } = editor.state.selection;
        if (from === to) {
          onWriteContentApplied?.({ applied: false, error: 'No selection to replace' });
          return;
        }
        insertFrom = from;
        editor.chain().focus().insertContentAt({ from, to }, content).run();
        summary = 'Replaced selected text';
      } else if (operation === 'append_document') {
        const docEnd = editor.state.doc.content.size;
        insertFrom = docEnd;
        editor.chain().focus().insertContentAt(docEnd, content).run();
        summary = 'Appended content';
      } else {
        insertFrom = editor.state.selection.from;
        editor.chain().focus().insertContentAt(insertFrom, content).run();
        summary = 'Inserted content';
      }

      // Mark inserted text as AI-generated
      const endPos = editor.state.selection.from;
      if (endPos > insertFrom && typeof editor.chain === 'function') {
        try {
          editor
            .chain()
            .setTextSelection({ from: insertFrom, to: endPos })
            .setAIGeneratedMark?.({
              aiId: pendingWriteContent.toolCallId,
              aiTool: 'write_content',
              aiTimestamp: new Date().toISOString(),
              aiStatus: 'accepted',
            })
            .run();
          editor.commands.setTextSelection(endPos);
        } catch {
          // AI mark extension may not be loaded
        }
      }

      let snapshotJson: string | undefined;
      try {
        if (typeof editor.getJSON === 'function') {
          snapshotJson = JSON.stringify(editor.getJSON());
        }
      } catch {
        snapshotJson = undefined;
      }

      onWriteContentApplied?.({
        applied: true,
        documentId: pendingWriteContent.documentId,
        snapshotJson,
        summary,
      });
    } catch (error) {
      onWriteContentApplied?.({
        applied: false,
        error: error instanceof Error ? error.message : 'Failed to apply write_content',
      });
    }
  }, [pendingWriteContent, collaborationDocumentId, onWriteContentApplied, readyDocumentId]);

  // Reset pending applied flag when pendingWriteContent changes
  useEffect(() => {
    if (!pendingWriteContent) {
      pendingWriteContentAppliedRef.current = false;
    }
  }, [pendingWriteContent]);

  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor || editor.isDestroyed) return;
    editor.commands.setFlowFocusLevel?.(effectiveFocusLevel);
    editor.commands.setFlowDimOpacity?.(effectiveDimOpacity);
    editor.commands.setTypewriterScrolling?.(effectiveTypewriterScrolling);
  }, [effectiveFocusLevel, effectiveDimOpacity, effectiveTypewriterScrolling, readyDocumentId]);

  const handleSyncError = useCallback((error: Error) => {
    setAutosaveError(error.message);
  }, []);

  useEffect(() => {
    setAutosaveError(null);
  }, [activeDocId, collaborationDocumentId]);

  return (
    <div
      className="editor-shell"
      data-testid="editor-root"
      data-document-id={collaborationDocumentId}
      data-project-id={collaboration?.projectId}
    >
      <span
        data-testid="editor-view"
        data-document-id={collaborationDocumentId}
        data-project-id={collaboration?.projectId}
        style={{ display: 'none' }}
      />
      {editorReady && (
        <span data-testid="editor-ready" style={{ display: 'none' }} />
      )}
      <span
        data-testid="autosave-status"
        data-status={autosaveStatus}
        style={{ display: 'none' }}
      >
        {autosaveStatus}
      </span>
      <span data-testid="editor-document-id" style={{ display: 'none' }}>
        {collaborationDocumentId}
      </span>
      {autosaveError && (
        <span data-testid="autosave-error" style={{ display: 'none' }}>
          {autosaveError}
        </span>
      )}
      {!minimalMode && (
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
          widgetStatusMap={widgetStatusMap}
        />
      )}

      {!minimalMode && (
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
      )}

      {!minimalMode && (
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
          onImport={emitOpenImport}
          onExport={emitOpenExport}
          onUndo={() => {}}
          onVersionHistory={() => {
            setShowMoreMenu(false);
            onVersionHistory?.();
          }}
        />
      )}

      <main className="editor-shell-main">
        {/* Key forces remount on tab switch to reset Editor's internal state */}
        {shouldUseCollaboration ? (
          <CollaborativeEditor
            key={activeDocId}
            projectId={collaboration!.projectId}
            documentId={collaborationDocumentId}
            user={collaboration!.user}
            authToken={collaboration!.authToken ?? undefined}
            convexUrl={collaboration!.convexUrl}
            title={activeDoc?.title ?? ''}
            onTitleChange={handleTitleChange}
            onChange={handleContentChange}
            onSelectionChange={handleSelectionChange}
            onEditorReady={handleEditorReady}
            onSyncError={handleSyncError}
            fontStyle={fontStyle}
            isSmallText={isSmallText}
            isFullWidth={isFullWidth}
            editable={!isLocked}
            showTitle={true}
            autoFocus
            scrollIndicatorRightOffset={scrollIndicatorRightOffset}
          />
        ) : (
          <Editor
            key={activeDocId}
            title={activeDoc?.title ?? ''}
            content={activeDoc?.content ?? ''}
            onTitleChange={handleTitleChange}
            onChange={handleContentChange}
            onSelectionChange={handleSelectionChange}
            onEditorReady={handleEditorReady}
            fontStyle={fontStyle}
            isSmallText={isSmallText}
            isFullWidth={isFullWidth}
            editable={!isLocked}
            showTitle={true}
            autoFocus
            syncContentFromProps={false}
            extraExtensions={flowExtensions}
            scrollIndicatorRightOffset={scrollIndicatorRightOffset}
          />
        )}

        {isEmpty && !hideQuickActions && (
          <QuickActions
            className="editor-shell-quick-actions"
            onAction={handleQuickAction}
          />
        )}
      </main>

      <style>{`
        /* Hide all native scrollbars in editor shell - using custom indicator */
        .editor-shell,
        .editor-shell * {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .editor-shell::-webkit-scrollbar,
        .editor-shell *::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

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
