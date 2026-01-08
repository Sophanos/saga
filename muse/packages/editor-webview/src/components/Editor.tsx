import { useEditor, EditorContent } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import { WriterKit, SlashCommand } from '@mythos/editor';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createSlashCommandSuggestion } from './suggestion';
import { BubbleMenu } from './BubbleMenu';
import { AICommandPalette, type AIQuickAction } from './AICommandPalette';
import { AIResponseBlock } from './AIResponseBlock';
import 'tippy.js/dist/tippy.css';

type FontStyle = 'default' | 'serif' | 'mono';
type AIBlockStatus = 'idle' | 'streaming' | 'complete' | 'error';

interface AIState {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  selectedText: string;
  showResponse: boolean;
  status: AIBlockStatus;
  response: string;
  prompt: string;
  selectionEndPos: number; // Store selection end for "jump to" feature
  showJumpIndicator: boolean; // Show floating jump indicator when selection end is off-screen
}

interface EditorProps {
  content?: string;
  onChange?: (content: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  onAskAI?: (selectedText: string, prompt?: string, action?: AIQuickAction) => void;
  placeholder?: string;
  fontStyle?: FontStyle;
  isSmallText?: boolean;
  isFullWidth?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
}

export function Editor({
  content = '',
  onChange,
  onSelectionChange,
  onAskAI,
  placeholder = "Press '/' for commands, or start writing...",
  fontStyle = 'default',
  isSmallText = false,
  isFullWidth = false,
  autoFocus = false,
  editable = true,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // AI inline state
  const [aiState, setAIState] = useState<AIState>({
    isOpen: false,
    position: null,
    selectedText: '',
    showResponse: false,
    status: 'idle',
    response: '',
    prompt: '',
    selectionEndPos: 0,
    showJumpIndicator: false,
  });

  const editor = useEditor({
    extensions: [
      WriterKit,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'editor-empty',
      }),
      SlashCommand.configure({
        suggestion: createSlashCommandSuggestion(),
      }),
    ],
    content,
    editable,
    autofocus: autoFocus ? 'end' : false,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        onSelectionChange?.({ from, to, text });
      } else {
        onSelectionChange?.(null);
      }
    },
  });

  // Open AI Command Palette - positioned at END of selection (like pressing Enter)
  const openAIPalette = useCallback((selectedText = '') => {
    if (!editor) return;

    // Get position at the END of selection
    const { to } = editor.state.selection;
    const coords = editor.view.coordsAtPos(to);
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (!containerRect) {
      setAIState((s) => ({
        ...s,
        isOpen: true,
        position: { x: coords.left, y: coords.bottom + 8 },
        selectedText,
        showResponse: false,
        selectionEndPos: to,
        showJumpIndicator: false,
      }));
      return;
    }

    // Check if selection end is visible in viewport
    const isEndVisible =
      coords.bottom >= containerRect.top &&
      coords.bottom <= containerRect.bottom &&
      coords.left >= containerRect.left &&
      coords.left <= containerRect.right;

    // Calculate position - keep palette within container bounds
    const paletteWidth = 440; // Approximate width of palette
    const xPos = Math.max(16, Math.min(coords.left - containerRect.left, containerRect.width - paletteWidth - 16));
    const yPos = coords.bottom - containerRect.top + 8;

    // If selection end is off-screen, show jump indicator instead
    if (!isEndVisible) {
      setAIState((s) => ({
        ...s,
        isOpen: false,
        showJumpIndicator: true,
        selectedText,
        selectionEndPos: to,
        showResponse: false,
      }));
      return;
    }

    setAIState((s) => ({
      ...s,
      isOpen: true,
      position: { x: xPos, y: yPos },
      selectedText,
      showResponse: false,
      selectionEndPos: to,
      showJumpIndicator: false,
    }));
  }, [editor]);

  // Jump to selection end and open palette
  const jumpToSelectionEnd = useCallback(() => {
    if (!editor) return;

    // Scroll to selection end
    const coords = editor.view.coordsAtPos(aiState.selectionEndPos);
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      // Scroll the element into view
      const scrollContainer = containerRef.current;
      if (scrollContainer) {
        const scrollTarget = coords.top - containerRect.top - 100; // 100px offset from top
        scrollContainer.scrollTo({
          top: scrollContainer.scrollTop + scrollTarget,
          behavior: 'smooth'
        });
      }
    }

    // After scroll, open the palette
    setTimeout(() => {
      const newCoords = editor.view.coordsAtPos(aiState.selectionEndPos);
      const newContainerRect = containerRef.current?.getBoundingClientRect();

      if (newContainerRect) {
        const paletteWidth = 440;
        const xPos = Math.max(16, Math.min(newCoords.left - newContainerRect.left, newContainerRect.width - paletteWidth - 16));
        const yPos = newCoords.bottom - newContainerRect.top + 8;

        setAIState((s) => ({
          ...s,
          isOpen: true,
          showJumpIndicator: false,
          position: { x: xPos, y: yPos },
        }));
      }
    }, 300); // Wait for scroll animation
  }, [editor, aiState.selectionEndPos]);

  // Handle AI submit
  const handleAISubmit = useCallback(
    (prompt: string, action?: AIQuickAction) => {
      const selectedText = aiState.selectedText;

      // Close palette and show response block
      setAIState((s) => ({
        ...s,
        isOpen: false,
        showResponse: true,
        status: 'streaming',
        prompt: prompt || action?.label || '',
        response: '',
      }));

      // Notify parent
      onAskAI?.(selectedText, prompt, action);

      // Simulate streaming response (replace with actual AI call)
      simulateStreamingResponse(prompt || action?.label || '');
    },
    [aiState.selectedText, onAskAI]
  );

  // Simulate streaming (for demo - replace with real API)
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

      // Simulate typing effect
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

  // Handle response actions
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+J to open AI palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        if (!editor) return;

        const { from, to } = editor.state.selection;
        const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : '';
        openAIPalette(selectedText);
      }

      // Escape to close AI palette or response
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
  }, [editor, openAIPalette, aiState.isOpen, aiState.showResponse, aiState.status, handleDiscard]);

  // Listen for slash command /ai trigger
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

  // Handle BubbleMenu AI click
  const handleBubbleMenuAI = useCallback(
    (selectedText: string) => {
      openAIPalette(selectedText);
    },
    [openAIPalette]
  );

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const fontFamilyClass = `editor-font--${fontStyle}`;
  const sizeClass = isSmallText ? 'editor-size--small' : '';
  const widthClass = isFullWidth ? 'editor-width--full' : '';

  return (
    <div ref={containerRef} className={`editor-container ${fontFamilyClass} ${sizeClass} ${widthClass}`}>
      <EditorContent editor={editor} className="editor-content" />
      {editor && <BubbleMenu editor={editor} onAskAI={handleBubbleMenuAI} />}

      {/* Jump to Selection Indicator (when selection end is off-screen) */}
      {aiState.showJumpIndicator && (
        <button
          className="ai-jump-indicator"
          onClick={jumpToSelectionEnd}
          title="Jump to selection end"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 8.5C8.5 7 11 6.5 12 6.5C13 6.5 15.5 7 17 8.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            <path
              d="M14 11C14 11 15 10.5 16 11.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M10 17C11 18 13 18 14 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      )}

      {/* AI Command Palette */}
      {aiState.isOpen && aiState.position && (
        <AICommandPalette
          selectedText={aiState.selectedText}
          position={aiState.position}
          onClose={() => setAIState((s) => ({ ...s, isOpen: false, showJumpIndicator: false }))}
          onSubmit={handleAISubmit}
        />
      )}

      {/* AI Response Block */}
      {aiState.showResponse && (
        <div className="ai-response-container" style={aiState.position ? { top: aiState.position.y } : undefined}>
          <AIResponseBlock
            status={aiState.status}
            response={aiState.response}
            onInsertBelow={handleInsertBelow}
            onRetry={handleRetry}
            onDiscard={handleDiscard}
            onFollowUp={handleFollowUp}
            onStop={() => setAIState((s) => ({ ...s, status: 'complete' }))}
          />
        </div>
      )}

      <style>{`
        .editor-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: var(--space-8) var(--space-4);
        }

        .editor-content {
          flex: 1;
          max-width: var(--content-max-width);
          width: 100%;
          margin: 0 auto;
        }

        .editor-width--full .editor-content {
          max-width: 100%;
          padding: 0 var(--space-8);
        }

        /* ProseMirror base styles */
        .editor-content .ProseMirror {
          outline: none;
          min-height: 100%;
        }

        .editor-content .ProseMirror > * + * {
          margin-top: 0.75em;
        }

        /* Typography */
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
          font-size: var(--text-base);
          line-height: var(--leading-relaxed);
          color: var(--color-text);
        }

        .editor-size--small .ProseMirror {
          font-size: var(--text-sm);
        }

        /* Headings */
        .editor-content .ProseMirror h1 {
          font-family: var(--font-display);
          font-size: var(--text-4xl);
          font-weight: var(--font-bold);
          line-height: var(--leading-tight);
          color: var(--color-text);
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }

        .editor-content .ProseMirror h1:first-child {
          margin-top: 0;
        }

        .editor-content .ProseMirror h2 {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: var(--font-semibold);
          line-height: var(--leading-tight);
          color: var(--color-text);
          margin-top: 1.25em;
          margin-bottom: 0.4em;
        }

        .editor-content .ProseMirror h3 {
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          line-height: var(--leading-tight);
          color: var(--color-text);
          margin-top: 1em;
          margin-bottom: 0.3em;
        }

        /* Paragraph */
        .editor-content .ProseMirror p {
          margin: 0;
        }

        .editor-content .ProseMirror p.editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--color-text-ghost);
          float: left;
          height: 0;
          pointer-events: none;
        }

        /* Lists */
        .editor-content .ProseMirror ul,
        .editor-content .ProseMirror ol {
          padding-left: 1.5em;
        }

        .editor-content .ProseMirror li {
          margin: 0.25em 0;
        }

        .editor-content .ProseMirror li p {
          margin: 0;
        }

        .editor-content .ProseMirror ul {
          list-style-type: disc;
        }

        .editor-content .ProseMirror ol {
          list-style-type: decimal;
        }

        /* Blockquote */
        .editor-content .ProseMirror blockquote {
          border-left: 3px solid var(--color-border);
          padding-left: var(--space-4);
          color: var(--color-text-secondary);
          font-style: italic;
        }

        /* Code */
        .editor-content .ProseMirror code {
          font-family: var(--font-mono);
          font-size: 0.9em;
          background: var(--color-bg-elevated);
          padding: 0.15em 0.4em;
          border-radius: var(--radius-sm);
          color: var(--color-accent);
        }

        .editor-content .ProseMirror pre {
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          overflow-x: auto;
        }

        .editor-content .ProseMirror pre code {
          background: none;
          padding: 0;
          border-radius: 0;
          color: var(--color-text);
        }

        /* Horizontal rule */
        .editor-content .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--color-border);
          margin: 1.5em 0;
        }

        /* Strong & Emphasis */
        .editor-content .ProseMirror strong {
          font-weight: var(--font-semibold);
          color: var(--color-text);
        }

        .editor-content .ProseMirror em {
          font-style: italic;
        }

        /* Links */
        .editor-content .ProseMirror a {
          color: var(--color-accent);
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
        }

        .editor-content .ProseMirror a:hover {
          color: var(--color-accent-hover);
        }

        /* Selection */
        .editor-content .ProseMirror ::selection {
          background: var(--color-accent-subtle);
        }

        /* Cursor */
        .editor-content .ProseMirror .ProseMirror-cursor {
          border-color: var(--color-accent);
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

        /* Task lists */
        .editor-content .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }

        .editor-content .ProseMirror li[data-type="taskItem"] {
          display: flex;
          align-items: flex-start;
          gap: var(--space-2, 8px);
        }

        .editor-content .ProseMirror li[data-type="taskItem"] > label {
          flex-shrink: 0;
          margin-top: 0.25em;
          user-select: none;
        }

        .editor-content .ProseMirror li[data-type="taskItem"] > label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: var(--color-accent);
          cursor: pointer;
        }

        .editor-content .ProseMirror li[data-type="taskItem"][data-checked="true"] > div {
          text-decoration: line-through;
          color: var(--color-text-secondary);
        }

        /* Images */
        .editor-content .ProseMirror .editor-image {
          max-width: 100%;
          height: auto;
          border-radius: var(--radius-md, 8px);
          display: block;
          margin: 1em 0;
        }

        .editor-content .ProseMirror .editor-image.ProseMirror-selectednode {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }

        /* Tables */
        .editor-content .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          table-layout: fixed;
          overflow: hidden;
        }

        .editor-content .ProseMirror th,
        .editor-content .ProseMirror td {
          border: 1px solid var(--color-border, #e5e7eb);
          padding: var(--space-2, 8px) var(--space-3, 12px);
          text-align: left;
          vertical-align: top;
          min-width: 100px;
          position: relative;
        }

        .editor-content .ProseMirror th {
          background: var(--color-bg-elevated, #f9fafb);
          font-weight: var(--font-semibold, 600);
        }

        .editor-content .ProseMirror td {
          background: var(--color-bg-app, #ffffff);
        }

        .editor-content .ProseMirror .selectedCell {
          background: var(--color-accent-subtle, rgba(99, 102, 241, 0.1));
        }

        .editor-content .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--color-accent, #6366f1);
          cursor: col-resize;
        }

        /* Placeholder for title */
        .editor-content .ProseMirror h1.editor-empty::before {
          content: 'Untitled';
          color: var(--color-text-ghost);
          float: left;
          height: 0;
          pointer-events: none;
        }

        /* AI Response Container */
        .ai-response-container {
          position: relative;
          max-width: var(--content-max-width);
          width: 100%;
          margin: 0 auto;
          padding: 0 var(--space-4);
        }

        /* Jump to Selection Indicator */
        .ai-jump-indicator {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--color-bg-elevated, #fff);
          border: 1px solid var(--color-border, #e8e8e6);
          border-radius: 999px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          color: var(--color-text, #37352f);
          font-size: 14px;
          font-weight: 500;
          z-index: 1000;
          transition: all 0.15s ease;
        }

        .ai-jump-indicator:hover {
          background: var(--color-bg-hover, #f1f1ef);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.06);
          transform: translateX(-50%) translateY(-2px);
        }

        .ai-jump-indicator:active {
          transform: translateX(-50%) translateY(0);
        }

        .ai-jump-indicator svg:first-child {
          width: 28px;
          height: 28px;
          padding: 4px;
          background: var(--color-bg-surface, #f7f7f5);
          border: 1px solid var(--color-border, #e8e8e6);
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}

export type { EditorProps };
