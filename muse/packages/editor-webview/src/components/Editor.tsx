import { useEditor, EditorContent } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import { WriterKit, SlashCommand } from '@mythos/editor';
import { type AnyExtension, type Content } from '@tiptap/core';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createSlashCommandSuggestion } from './suggestion';
import { BubbleMenu } from './BubbleMenu';
import { AICommandPalette, type AIQuickAction, type SelectionVirtualElement } from './AICommandPalette';
import { AIResponseBlock } from './AIResponseBlock';
import { BatchApprovalBar } from './BatchApprovalBar';
import { AIGeneratedMark } from '../extensions/ai-generated-mark';
import { SuggestionPlugin, type Suggestion } from '../extensions/suggestion-plugin';
import {
  RemoteCursorExtension,
  updateRemoteCursors,
  type RemoteCursorUser,
} from '../extensions/remote-cursor';
import {
  useEditorBridge,
  type EditorInstance,
  type EditorToNativeMessage,
  type NativeToEditorMessage,
} from '../bridge';
import 'tippy.js/dist/tippy.css';

type FontStyle = 'default' | 'serif' | 'mono';
type AIBlockStatus = 'idle' | 'streaming' | 'complete' | 'error';

interface AIState {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  /** Virtual element for Floating UI positioning */
  virtualElement: SelectionVirtualElement | null;
  selectedText: string;
  showResponse: boolean;
  status: AIBlockStatus;
  response: string;
  prompt: string;
  selectionEndPos: number;
  showJumpIndicator: boolean;
}

interface SuggestionState {
  /** All pending suggestions */
  suggestions: Suggestion[];
  /** Currently selected suggestion ID */
  selectedId: string | null;
}

interface EditorProps {
  content?: Content;
  title?: string;
  onChange?: (content: string) => void;
  onTitleChange?: (title: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  onAskAI?: (selectedText: string, prompt?: string, action?: AIQuickAction) => void;
  onSuggestionAccepted?: (suggestion: Suggestion) => void;
  onSuggestionRejected?: (suggestion: Suggestion) => void;
  onSuggestionsChange?: (suggestions: Suggestion[]) => void;
  onBridgeMessage?: (message: NativeToEditorMessage) => void;
  onCursorChange?: (selection: { from: number; to: number }) => void;
  onFocusChange?: (focused: boolean) => void;
  placeholder?: string;
  fontStyle?: FontStyle;
  isSmallText?: boolean;
  isFullWidth?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  showTitle?: boolean;
  /** Enable bridge for WebView communication (Tauri/React Native) */
  enableBridge?: boolean;
  /** Additional TipTap extensions (collaboration, etc.) */
  extraExtensions?: AnyExtension[];
  /** Remote cursor presence data */
  remoteCursors?: RemoteCursorUser[];
  /** Current user ID for cursor filtering */
  currentUserId?: string;
  /** Disable syncing content from props (useful for collaboration) */
  syncContentFromProps?: boolean;
}

export function Editor({
  content = '',
  title = '',
  onChange,
  onTitleChange,
  onSelectionChange,
  onAskAI,
  onSuggestionAccepted: _onSuggestionAccepted,
  onSuggestionRejected: _onSuggestionRejected,
  onSuggestionsChange: _onSuggestionsChange,
  onBridgeMessage,
  onCursorChange,
  onFocusChange,
  placeholder = "Press '/' for commands, or start writing...",
  fontStyle = 'default',
  isSmallText = false,
  isFullWidth = false,
  autoFocus = false,
  editable = true,
  showTitle = true,
  enableBridge: _enableBridge = false,
  extraExtensions,
  remoteCursors,
  currentUserId,
  syncContentFromProps = true,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const lastContentRef = useRef<Content | null>(null);
  const bridgeSendRef = useRef<((message: EditorToNativeMessage) => void) | null>(null);
  const [localTitle, setLocalTitle] = useState(title);

  // Suggestion state (reserved for future suggestion feature)
  const [_suggestionState, _setSuggestionState] = useState<SuggestionState>({
    suggestions: [],
    selectedId: null,
  });

  const [aiState, setAIState] = useState<AIState>({
    isOpen: false,
    position: null,
    virtualElement: null,
    selectedText: '',
    showResponse: false,
    status: 'idle',
    response: '',
    prompt: '',
    selectionEndPos: 0,
    showJumpIndicator: false,
  });

  // Handlers for suggestion callbacks
  const handleSuggestionAccepted = useCallback((suggestion: Suggestion) => {
    _onSuggestionAccepted?.(suggestion);
  }, [_onSuggestionAccepted]);

  const handleSuggestionRejected = useCallback((suggestion: Suggestion) => {
    _onSuggestionRejected?.(suggestion);
  }, [_onSuggestionRejected]);

  const handleSuggestionsChange = useCallback((suggestions: Suggestion[]) => {
    _setSuggestionState(prev => ({ ...prev, suggestions }));
    _onSuggestionsChange?.(suggestions);
  }, [_onSuggestionsChange]);

  const remoteCursorExtension = useMemo(() => {
    if (!remoteCursors) return null;
    return RemoteCursorExtension.configure({
      users: [],
      currentUserId,
    });
  }, [remoteCursors, currentUserId]);

  const editorExtensions = useMemo(() => {
    return [
      WriterKit,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'editor-empty',
      }),
      SlashCommand.configure({
        suggestion: createSlashCommandSuggestion(),
      }),
      // AI suggestion extensions
      AIGeneratedMark,
      SuggestionPlugin.configure({
        onAccept: handleSuggestionAccepted,
        onReject: handleSuggestionRejected,
        onSuggestionsChange: handleSuggestionsChange,
      }),
      ...(remoteCursorExtension ? [remoteCursorExtension] : []),
      ...(extraExtensions ?? []),
    ];
  }, [
    placeholder,
    handleSuggestionAccepted,
    handleSuggestionRejected,
    handleSuggestionsChange,
    remoteCursorExtension,
    extraExtensions,
  ]);

  const editor = useEditor({
    extensions: editorExtensions,
    content,
    editable,
    autofocus: autoFocus && !showTitle ? 'end' : false,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
      if (_enableBridge && bridgeSendRef.current) {
        bridgeSendRef.current({
          type: 'contentChange',
          content: editor.getText(),
          html,
        });
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const selection =
        from !== to
          ? { from, to, text: editor.state.doc.textBetween(from, to, ' ') }
          : null;
      if (selection) {
        onSelectionChange?.(selection);
      } else {
        onSelectionChange?.(null);
      }
      onCursorChange?.({ from, to });
      if (_enableBridge && bridgeSendRef.current) {
        bridgeSendRef.current({ type: 'selectionChange', selection });
      }
    },
  });

  // Bridge for WebView communication (Tauri/React Native)
  const { send: sendBridgeMessage } = useEditorBridge(
    _enableBridge ? (editor as unknown as EditorInstance) : null,
    { onMessage: onBridgeMessage }
  );

  useEffect(() => {
    bridgeSendRef.current = sendBridgeMessage;
  }, [sendBridgeMessage]);

  useEffect(() => {
    if (!editor) return;
    const handleFocus = () => {
      onFocusChange?.(true);
      if (_enableBridge) {
        bridgeSendRef.current?.({ type: 'editorFocused' });
      }
    };
    const handleBlur = () => {
      onFocusChange?.(false);
      if (_enableBridge) {
        bridgeSendRef.current?.({ type: 'editorBlurred' });
      }
    };
    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);
    return () => {
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
    };
  }, [editor, onFocusChange, _enableBridge]);

  useEffect(() => {
    if (!editor || !remoteCursors) return;
    updateRemoteCursors(editor, remoteCursors);
  }, [editor, remoteCursors]);

  // Sync title from props
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Auto-resize title textarea
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [localTitle]);

  // Focus title on mount if showTitle and autoFocus
  useEffect(() => {
    if (showTitle && autoFocus && titleRef.current) {
      titleRef.current.focus();
    }
  }, [showTitle, autoFocus]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newTitle = e.target.value;
    setLocalTitle(newTitle);
    onTitleChange?.(newTitle);
    if (_enableBridge && bridgeSendRef.current) {
      bridgeSendRef.current({ type: 'titleChange', title: newTitle });
    }
  }, [onTitleChange, _enableBridge]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
    if (e.key === 'ArrowDown') {
      const textarea = e.currentTarget;
      const isAtEnd = textarea.selectionStart === textarea.value.length;
      if (isAtEnd) {
        e.preventDefault();
        editor?.commands.focus('start');
      }
    }
  }, [editor]);

  const openAIPalette = useCallback((selectedText = '') => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const maxPos = editor.state.doc.nodeSize - 2;
    const startPos = Math.max(0, Math.min(from, maxPos));
    const endPos = Math.max(0, Math.min(to, maxPos));

    const startCoords = editor.view.coordsAtPos(startPos);
    const endCoords = editor.view.coordsAtPos(endPos);
    const viewportHeight = window.innerHeight;
    const paletteHeight = 500;
    const spaceBelow = viewportHeight - endCoords.bottom;
    const hasEnoughSpaceBelow = spaceBelow >= paletteHeight;
    const isSelectionVisible = endCoords.bottom > 0 && endCoords.top < viewportHeight;

    if (!isSelectionVisible || !hasEnoughSpaceBelow) {
      setAIState((s) => ({
        ...s,
        isOpen: false,
        showJumpIndicator: true,
        selectedText,
        selectionEndPos: endPos,
        showResponse: false,
        virtualElement: null,
      }));
      return;
    }

    const rect = new DOMRect(
      startCoords.left,
      startCoords.top,
      endCoords.right - startCoords.left,
      endCoords.bottom - startCoords.top
    );
    const virtualElement: SelectionVirtualElement = {
      getBoundingClientRect: () => rect,
      getClientRects: () => [rect],
    };

    setAIState((s) => ({
      ...s,
      isOpen: true,
      virtualElement,
      selectedText,
      showResponse: false,
      selectionEndPos: endPos,
      showJumpIndicator: false,
    }));
  }, [editor]);

  const jumpToSelectionEnd = useCallback(() => {
    if (!editor) return;

    const maxPos = editor.state.doc.nodeSize - 2;
    const targetPos = Math.max(0, Math.min(aiState.selectionEndPos, maxPos));
    const coords = editor.view.coordsAtPos(targetPos);
    const scrollTarget = window.scrollY + coords.top - 100;

    window.scrollTo({ top: scrollTarget, behavior: 'smooth' });

    setTimeout(() => {
      const newCoords = editor.view.coordsAtPos(targetPos);
      const { from } = editor.state.selection;
      const startPos = Math.max(0, Math.min(from, maxPos));
      const startCoords = editor.view.coordsAtPos(startPos);

      const rect = new DOMRect(
        startCoords.left,
        startCoords.top,
        newCoords.right - startCoords.left,
        newCoords.bottom - startCoords.top
      );
      const virtualElement: SelectionVirtualElement = {
        getBoundingClientRect: () => rect,
        getClientRects: () => [rect],
      };

      setAIState((s) => ({
        ...s,
        isOpen: true,
        showJumpIndicator: false,
        virtualElement,
      }));
    }, 400);
  }, [editor, aiState.selectionEndPos]);

  const handleAISubmit = useCallback(
    (prompt: string, action?: AIQuickAction) => {
      const selectedText = aiState.selectedText;

      setAIState((s) => ({
        ...s,
        isOpen: false,
        showResponse: true,
        status: 'streaming',
        prompt: prompt || action?.label || '',
        response: '',
      }));

      onAskAI?.(selectedText, prompt, action);
      simulateStreamingResponse(prompt || action?.label || '');
    },
    [aiState.selectedText, onAskAI]
  );

  const simulateStreamingResponse = useCallback(
    (prompt: string) => {
      const demoResponses: Record<string, string> = {
        improve:
          'Here\'s an improved version of your text with enhanced clarity and flow:\n\n"The morning light filtered through the curtains, casting long shadows across the wooden floor. She paused at the doorway, taking in the familiar scent of coffee and old books."',
        proofread:
          'I found a few suggestions:\n\n1. Consider adding a comma after "However"\n2. "Their" should be "there" in sentence 3\n3. The paragraph could benefit from shorter sentences for better readability.',
        expand:
          'Here\'s an expanded version with more detail:\n\n"The ancient library stood at the heart of the city, its towering stone walls weathered by centuries of rain and wind. Inside, countless rows of shelves stretched toward a vaulted ceiling painted with faded celestial maps. The air hung thick with the musty perfume of aging paper and leather bindings, a scent that spoke of forgotten knowledge waiting to be rediscovered."',
        shorten:
          'Here\'s a more concise version:\n\n"The library held countless secrets within its weathered walls."',
        continue:
          'She stepped forward, her footsteps echoing in the empty hall. The portrait seemed to follow her with its painted eyes, a silent witness to her midnight wandering. Something about this place felt different tonight—charged with an electricity she couldn\'t name.',
      };

      const responseText =
        demoResponses[prompt.toLowerCase()] ||
        `I understand you want me to ${prompt}. Here's my response based on the context provided:\n\nThis is a demonstration of the AI response feature. In production, this would connect to your AI backend to generate contextual responses based on your story content and the selected text.`;

      let index = 0;
      const interval = setInterval(() => {
        index += Math.floor(Math.random() * 3) + 1;
        if (index >= responseText.length) {
          setAIState((s) => ({
            ...s,
            response: responseText,
            status: 'complete',
          }));
          clearInterval(interval);
        } else {
          setAIState((s) => ({
            ...s,
            response: responseText.slice(0, index),
          }));
        }
      }, 20);
    },
    []
  );

  const handleInsertBelow = useCallback(
    (text: string) => {
      if (!editor) return;
      editor.commands.insertContentAt(editor.state.selection.to, `\n\n${text}`);
      setAIState((s) => ({ ...s, showResponse: false, status: 'idle', response: '' }));
    },
    [editor]
  );

  const handleRetry = useCallback(() => {
    setAIState((s) => ({
      ...s,
      status: 'streaming',
      response: '',
    }));
    simulateStreamingResponse(aiState.prompt);
  }, [aiState.prompt, simulateStreamingResponse]);

  const handleDiscard = useCallback(() => {
    setAIState((s) => ({
      ...s,
      showResponse: false,
      status: 'idle',
      response: '',
      prompt: '',
    }));
  }, []);

  const handleFollowUp = useCallback(
    (prompt: string) => {
      setAIState((s) => ({
        ...s,
        status: 'streaming',
        prompt,
        response: '',
      }));
      simulateStreamingResponse(prompt);
    },
    [simulateStreamingResponse]
  );

  // Suggestion handlers for batch approval bar
  const handleAcceptAll = useCallback(() => {
    if (!editor) return;
    (editor as unknown as { commands: { acceptAllSuggestions: () => boolean } }).commands.acceptAllSuggestions();
  }, [editor]);

  const handleRejectAll = useCallback(() => {
    if (!editor) return;
    (editor as unknown as { commands: { rejectAllSuggestions: () => boolean } }).commands.rejectAllSuggestions();
  }, [editor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        if (!editor) return;

        const { from, to } = editor.state.selection;
        const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
        openAIPalette(selectedText);
      }

      // Suggestion keyboard shortcuts
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
        // ⌘⇧⏎ - Accept all suggestions
        e.preventDefault();
        handleAcceptAll();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Backspace') {
        // ⌘⇧⌫ - Reject all suggestions
        e.preventDefault();
        handleRejectAll();
      }

      if (e.key === 'Escape') {
        if (aiState.isOpen) {
          setAIState((s) => ({ ...s, isOpen: false }));
          e.preventDefault();
        } else if (aiState.showResponse && aiState.status === 'complete') {
          handleDiscard();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, openAIPalette, aiState.isOpen, aiState.showResponse, aiState.status, handleDiscard, handleAcceptAll, handleRejectAll]);

  useEffect(() => {
    const handleOpenAIPalette = () => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
      openAIPalette(selectedText);
    };

    window.addEventListener('editor:open-ai-palette', handleOpenAIPalette);
    return () => window.removeEventListener('editor:open-ai-palette', handleOpenAIPalette);
  }, [editor, openAIPalette]);

  const handleBubbleMenuAI = useCallback(
    (selectedText: string) => {
      openAIPalette(selectedText);
    },
    [openAIPalette]
  );

  useEffect(() => {
    if (!syncContentFromProps || !editor) return;
    if (typeof content === 'undefined') return;
    if (lastContentRef.current === content) return;
    lastContentRef.current = content;
    editor.commands.setContent(content);
  }, [content, editor, syncContentFromProps]);

  const fontFamilyClass = `editor-font--${fontStyle}`;
  const sizeClass = isSmallText ? 'editor-size--small' : '';
  const widthClass = isFullWidth ? 'editor-width--full' : '';

  return (
    <div ref={containerRef} className={`editor-container ${fontFamilyClass} ${sizeClass} ${widthClass}`}>
      <div className="editor-content-wrapper">
        {showTitle && (
          <textarea
            ref={titleRef}
            className="editor-title"
            value={localTitle}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            rows={1}
            disabled={!editable}
          />
        )}
        <EditorContent editor={editor} className="editor-content" />
      </div>
      {editor && <BubbleMenu editor={editor} onAskAI={handleBubbleMenuAI} />}

      {aiState.showJumpIndicator && (
        <button className="ai-jump-indicator" onClick={jumpToSelectionEnd}>
          <div className="ai-jump-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 8.5C8.5 7 11 6.5 12 6.5C13 6.5 15.5 7 17 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="12" r="1.5" fill="currentColor" />
              <path d="M14 11C14 11 15 10.5 16 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10 17C11 18 13 18 14 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="ai-jump-text">Jump to selection</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      )}

      {aiState.isOpen && aiState.virtualElement && (
        <AICommandPalette
          selectedText={aiState.selectedText}
          virtualElement={aiState.virtualElement}
          onClose={() => setAIState((s) => ({ ...s, isOpen: false, showJumpIndicator: false }))}
          onSubmit={handleAISubmit}
        />
      )}

      {aiState.showResponse && aiState.virtualElement && (
        <AIResponseBlock
          status={aiState.status}
          response={aiState.response}
          virtualElement={aiState.virtualElement}
          onInsertBelow={handleInsertBelow}
          onRetry={handleRetry}
          onDiscard={handleDiscard}
          onFollowUp={handleFollowUp}
          onStop={() => setAIState((s) => ({ ...s, status: 'complete' }))}
        />
      )}

      {/* Batch approval bar for multiple pending suggestions */}
      <BatchApprovalBar
        suggestions={_suggestionState.suggestions}
        onAcceptAll={handleAcceptAll}
        onRejectAll={handleRejectAll}
      />

      <style>{`
        .editor-container {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 80px 96px 120px;
        }

        @media (max-width: 900px) {
          .editor-container {
            padding: 60px 48px 100px;
          }
        }

        @media (max-width: 600px) {
          .editor-container {
            padding: 40px 24px 80px;
          }
        }

        .editor-content-wrapper {
          flex: 1;
          max-width: 708px;
          width: 100%;
          margin: 0 auto;
        }

        .editor-width--full .editor-content-wrapper {
          max-width: 100%;
        }

        /* Title Input - Notion style large editable title */
        .editor-title {
          display: block;
          width: 100%;
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 700;
          line-height: 1.2;
          color: var(--color-text);
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          overflow: hidden;
          padding: 0;
          margin: 0 0 12px 0;
          caret-color: var(--color-text);
        }

        .editor-title::placeholder {
          color: var(--color-text-ghost);
        }

        .editor-title:disabled {
          cursor: default;
        }

        .editor-content {
          flex: 1;
        }

        /* ProseMirror base styles */
        .editor-content .ProseMirror {
          outline: none;
          min-height: 100%;
        }

        .editor-content .ProseMirror > * + * {
          margin-top: 1px;
        }

        /* Typography - Notion uses system fonts */
        .editor-font--default .ProseMirror {
          font-family: var(--font-sans);
        }

        .editor-font--serif .ProseMirror {
          font-family: var(--font-serif);
        }

        .editor-font--mono .ProseMirror {
          font-family: var(--font-mono);
        }

        .editor-content .ProseMirror {
          font-size: 16px;
          line-height: 1.5;
          color: var(--color-text);
          word-break: break-word;
        }

        .editor-size--small .ProseMirror {
          font-size: 14px;
        }

        /* Headings - Notion style */
        .editor-content .ProseMirror h1 {
          font-family: var(--font-display);
          font-size: 30px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--color-text);
          margin-top: 32px;
          margin-bottom: 4px;
        }

        .editor-content .ProseMirror h1:first-child {
          margin-top: 0;
        }

        .editor-content .ProseMirror h2 {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--color-text);
          margin-top: 28px;
          margin-bottom: 4px;
        }

        .editor-content .ProseMirror h3 {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--color-text);
          margin-top: 24px;
          margin-bottom: 4px;
        }

        /* Paragraph - Notion style tight spacing */
        .editor-content .ProseMirror p {
          margin: 0;
          min-height: 1.5em;
        }

        .editor-content .ProseMirror p + p {
          margin-top: 0;
        }

        /* Placeholder */
        .editor-content .ProseMirror p.editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--color-text-ghost);
          float: left;
          height: 0;
          pointer-events: none;
        }

        /* Lists - Notion style */
        .editor-content .ProseMirror ul,
        .editor-content .ProseMirror ol {
          padding-left: 24px;
          margin: 0;
        }

        .editor-content .ProseMirror li {
          margin: 0;
        }

        .editor-content .ProseMirror li + li {
          margin-top: 0;
        }

        .editor-content .ProseMirror li p {
          margin: 0;
        }

        .editor-content .ProseMirror ul {
          list-style-type: disc;
        }

        .editor-content .ProseMirror ul ul {
          list-style-type: circle;
        }

        .editor-content .ProseMirror ul ul ul {
          list-style-type: square;
        }

        .editor-content .ProseMirror ol {
          list-style-type: decimal;
        }

        /* Blockquote - Notion style */
        .editor-content .ProseMirror blockquote {
          border-left: 3px solid currentColor;
          padding-left: 14px;
          padding-right: 14px;
          margin: 0;
        }

        /* Inline Code - Notion's signature warm style */
        .editor-content .ProseMirror code {
          font-family: 'SFMono-Regular', Menlo, Consolas, 'PT Mono', 'Liberation Mono', Courier, monospace;
          font-size: 85%;
          background: rgba(135, 131, 120, 0.15);
          padding: 0.2em 0.4em;
          border-radius: 3px;
          color: #eb5757;
        }

        /* Code blocks */
        .editor-content .ProseMirror pre {
          background: var(--color-bg-surface);
          border-radius: 3px;
          padding: 32px 16px 32px 32px;
          overflow-x: auto;
          margin: 0;
          font-family: 'SFMono-Regular', Menlo, Consolas, 'PT Mono', 'Liberation Mono', Courier, monospace;
          font-size: 85%;
          tab-size: 2;
        }

        .editor-content .ProseMirror pre code {
          background: none;
          padding: 0;
          border-radius: 0;
          color: var(--color-text);
        }

        /* Horizontal rule - Notion style */
        .editor-content .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--color-border);
          margin: 6px 0;
        }

        /* Strong & Emphasis */
        .editor-content .ProseMirror strong {
          font-weight: 600;
        }

        .editor-content .ProseMirror em {
          font-style: italic;
        }

        /* Underline */
        .editor-content .ProseMirror u {
          text-decoration: underline;
        }

        /* Strikethrough */
        .editor-content .ProseMirror s {
          text-decoration: line-through;
        }

        /* Links - Notion style underline */
        .editor-content .ProseMirror a {
          color: inherit;
          text-decoration: underline;
          text-decoration-color: var(--color-text-muted);
          text-underline-offset: 3px;
          cursor: pointer;
          transition: text-decoration-color 100ms ease;
        }

        .editor-content .ProseMirror a:hover {
          text-decoration-color: var(--color-text);
        }

        /* Selection */
        .editor-content .ProseMirror ::selection {
          background: rgba(45, 170, 219, 0.3);
        }

        /* Remote cursors */
        .remote-selection {
          border-radius: 2px;
        }

        .remote-cursor {
          position: relative;
          margin-left: -1px;
          border-left: 2px solid;
          height: 1.2em;
          pointer-events: none;
        }

        .remote-cursor__label {
          position: absolute;
          top: -20px;
          left: -1px;
          padding: 2px 6px;
          border-radius: 6px;
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .remote-cursor--ai .remote-cursor__label {
          text-transform: none;
        }

        /* Entity marks (from @mythos/editor) */
        .editor-content .ProseMirror .entity-character {
          background: rgba(167, 139, 250, 0.15);
          border-bottom: 2px solid var(--color-purple);
          padding: 0 2px;
          border-radius: 2px;
        }

        .editor-content .ProseMirror .entity-location {
          background: rgba(52, 211, 153, 0.15);
          border-bottom: 2px solid var(--color-green);
          padding: 0 2px;
          border-radius: 2px;
        }

        .editor-content .ProseMirror .entity-item {
          background: rgba(251, 191, 36, 0.15);
          border-bottom: 2px solid var(--color-amber);
          padding: 0 2px;
          border-radius: 2px;
        }

        /* Task lists - Notion style */
        .editor-content .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }

        .editor-content .ProseMirror li[data-type="taskItem"] {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .editor-content .ProseMirror li[data-type="taskItem"] > label {
          flex-shrink: 0;
          margin-top: 2px;
          user-select: none;
        }

        .editor-content .ProseMirror li[data-type="taskItem"] > label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #2eaadc;
          cursor: pointer;
        }

        .editor-content .ProseMirror li[data-type="taskItem"][data-checked="true"] > div {
          text-decoration: line-through;
          color: var(--color-text-muted);
        }

        /* Images */
        .editor-content .ProseMirror .editor-image {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          display: block;
          margin: 4px 0;
        }

        .editor-content .ProseMirror .editor-image.ProseMirror-selectednode {
          outline: 2px solid #2eaadc;
          outline-offset: 2px;
        }

        /* Tables - Notion style */
        .editor-content .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 4px 0;
          table-layout: fixed;
          overflow: hidden;
        }

        .editor-content .ProseMirror th,
        .editor-content .ProseMirror td {
          border: 1px solid var(--color-border);
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
          min-width: 100px;
          position: relative;
        }

        .editor-content .ProseMirror th {
          background: var(--color-bg-surface);
          font-weight: 500;
        }

        .editor-content .ProseMirror .selectedCell {
          background: rgba(45, 170, 219, 0.1);
        }

        .editor-content .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background: #2eaadc;
          cursor: col-resize;
        }

        /* Jump to Selection Indicator */
        .ai-jump-indicator {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px 8px 8px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: 999px;
          box-shadow:
            0 0 0 1px rgba(15, 15, 15, 0.05),
            0 3px 6px rgba(15, 15, 15, 0.1),
            0 9px 24px rgba(15, 15, 15, 0.2);
          cursor: pointer;
          color: var(--color-text);
          font-size: 14px;
          font-weight: 500;
          z-index: 1000;
          transition: all 100ms ease;
        }

        .ai-jump-indicator:hover {
          background: var(--color-bg-hover);
          transform: translateX(-50%) translateY(-2px);
        }

        .ai-jump-indicator:active {
          transform: translateX(-50%) translateY(0);
        }

        .ai-jump-avatar {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          border-radius: 50%;
          color: var(--color-text);
        }

        .ai-jump-indicator svg:last-child {
          color: var(--color-text-secondary);
        }

        .ai-jump-text {
          color: var(--color-text-secondary);
        }
      `}</style>
    </div>
  );
}

export type { EditorProps };
