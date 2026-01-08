import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { useState, useCallback } from 'react';

interface BubbleMenuProps {
  editor: Editor | null;
  onAskAI?: (selectedText: string) => void;
}

const COLORS = [
  { name: 'Default', value: '' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

const HIGHLIGHTS = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Red', value: '#fecaca' },
  { name: 'Orange', value: '#fed7aa' },
];

export function BubbleMenu({ editor, onAskAI }: BubbleMenuProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const handleAskAI = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    onAskAI?.(text);
  }, [editor, onAskAI]);

  const handleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link')['href'];
    const url = window.prompt('URL:', previousUrl);

    if (url === null) return;
    if (url === '') {
      (editor.chain().focus().extendMarkRange('link') as any).unsetLink().run();
      return;
    }
    (editor.chain().focus().extendMarkRange('link') as any).setLink({ href: url }).run();
  }, [editor]);

  const setColor = useCallback(
    (color: string) => {
      if (!editor) return;
      if (color === '') {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
      }
      setShowColorPicker(false);
    },
    [editor]
  );

  const setHighlight = useCallback(
    (color: string) => {
      if (!editor) return;
      if (color === '') {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().setHighlight({ color }).run();
      }
      setShowHighlightPicker(false);
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <TiptapBubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        placement: 'top',
        offset: [0, 8],
      }}
    >
      <div className="bubble-menu">
        {/* AI Button with Muse Avatar */}
        <button
          className="bubble-menu-btn bubble-menu-btn--ai"
          onClick={handleAskAI}
          title="Ask AI"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="muse-icon">
            {/* Brow/thinking line */}
            <path
              d="M7 8.5C8.5 7 11 6.5 12 6.5C13 6.5 15.5 7 17 8.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Left eye */}
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            {/* Right eye */}
            <path
              d="M14 11C14 11 15 10.5 16 11.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Mouth */}
            <path
              d="M10 17C11 18 13 18 14 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="bubble-menu-label">AI</span>
        </button>
        <div className="bubble-menu-separator" />

        {/* Text Formatting */}
        <button
          className={`bubble-menu-btn ${editor.isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (⌘B)"
        >
          <strong>B</strong>
        </button>
        <button
          className={`bubble-menu-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (⌘I)"
        >
          <em>I</em>
        </button>
        <button
          className={`bubble-menu-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (⌘U)"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button
          className={`bubble-menu-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </button>
        <button
          className={`bubble-menu-btn ${editor.isActive('code') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Code (⌘E)"
        >
          {'</>'}
        </button>
        <button
          className={`bubble-menu-btn ${editor.isActive('link') ? 'active' : ''}`}
          onClick={handleLink}
          title="Link (⌘K)"
        >
          🔗
        </button>

        <div className="bubble-menu-separator" />

        {/* Color Picker */}
        <div className="bubble-menu-dropdown">
          <button
            className="bubble-menu-btn"
            onClick={() => {
              setShowColorPicker(!showColorPicker);
              setShowHighlightPicker(false);
            }}
            title="Text color"
          >
            <span
              style={{
                borderBottom: `3px solid ${editor.getAttributes('textStyle')['color'] || 'currentColor'}`,
              }}
            >
              A
            </span>
          </button>
          {showColorPicker && (
            <div className="bubble-menu-picker">
              {COLORS.map((color) => (
                <button
                  key={color.name}
                  className="bubble-menu-color"
                  style={{ backgroundColor: color.value || 'var(--color-text)' }}
                  onClick={() => setColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlight Picker */}
        <div className="bubble-menu-dropdown">
          <button
            className="bubble-menu-btn"
            onClick={() => {
              setShowHighlightPicker(!showHighlightPicker);
              setShowColorPicker(false);
            }}
            title="Highlight"
          >
            <span
              style={{
                backgroundColor: editor.getAttributes('highlight')['color'] || 'transparent',
                padding: '0 4px',
              }}
            >
              █
            </span>
          </button>
          {showHighlightPicker && (
            <div className="bubble-menu-picker">
              {HIGHLIGHTS.map((color) => (
                <button
                  key={color.name}
                  className="bubble-menu-color"
                  style={{
                    backgroundColor: color.value || 'var(--color-bg-app)',
                    border: color.value ? 'none' : '1px dashed var(--color-border)',
                  }}
                  onClick={() => setHighlight(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          )}
        </div>

        <style>{`
          .bubble-menu {
            display: flex;
            align-items: center;
            gap: 2px;
            padding: var(--space-1, 4px);
            background: var(--color-bg-elevated, #fff);
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: var(--radius-lg, 12px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          }

          .bubble-menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            height: 32px;
            padding: 0 8px;
            border: none;
            background: transparent;
            border-radius: var(--radius-md, 8px);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: var(--color-text, #111827);
            transition: background 0.15s;
          }

          .bubble-menu-btn:hover {
            background: var(--color-bg-hover, #f3f4f6);
          }

          .bubble-menu-btn.active {
            background: var(--color-accent-subtle, rgba(99, 102, 241, 0.1));
            color: var(--color-accent, #6366f1);
          }

          .bubble-menu-btn--ai {
            background: linear-gradient(135deg, #a855f7, #6366f1);
            color: white;
            gap: 4px;
          }

          .bubble-menu-btn--ai:hover {
            background: linear-gradient(135deg, #9333ea, #4f46e5);
          }

          .bubble-menu-btn--ai .muse-icon {
            flex-shrink: 0;
          }

          .bubble-menu-label {
            font-size: 12px;
            font-weight: 600;
          }

          .bubble-menu-separator {
            width: 1px;
            height: 20px;
            background: var(--color-border, #e5e7eb);
            margin: 0 4px;
          }

          .bubble-menu-dropdown {
            position: relative;
          }

          .bubble-menu-picker {
            position: absolute;
            top: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
            padding: 8px;
            background: var(--color-bg-elevated, #fff);
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: var(--radius-md, 8px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 10;
          }

          .bubble-menu-color {
            width: 24px;
            height: 24px;
            border: none;
            border-radius: var(--radius-sm, 4px);
            cursor: pointer;
            transition: transform 0.1s;
          }

          .bubble-menu-color:hover {
            transform: scale(1.15);
          }
        `}</style>
      </div>
    </TiptapBubbleMenu>
  );
}
