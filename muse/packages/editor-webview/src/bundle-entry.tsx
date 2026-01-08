import React from 'react';
import { createRoot } from 'react-dom/client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { AIGeneratedMark } from './extensions/ai-generated-mark';
import { SuggestionPlugin } from './extensions/suggestion-plugin';
import { AiToolkitExtension, getAiToolkit } from './extensions/ai-toolkit';
import { createEditorBridge } from './bridge';
import './styles/tokens.css';
import './styles/suggestions.css';

interface EditorBundleProps {
  initialContent?: string;
  placeholder?: string;
  editable?: boolean;
}

function EditorBundle({ 
  initialContent = '', 
  placeholder = "Start writing...",
  editable = true 
}: EditorBundleProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      AIGeneratedMark,
      SuggestionPlugin,
      AiToolkitExtension,
    ],
    content: initialContent,
    editable,
    autofocus: 'end',
  });

  React.useEffect(() => {
    if (!editor) return;

    const bridge = createEditorBridge();
    
    bridge.registerEditor({
      commands: {
        setContent: (content: string) => editor.commands.setContent(content),
        insertContent: (content: string) => editor.commands.insertContent(content),
        insertContentAt: (pos: number, content: string) => editor.commands.insertContentAt(pos, content),
        addSuggestion: (s) => (editor.commands as any).addSuggestion(s),
        acceptSuggestion: (id: string) => (editor.commands as any).acceptSuggestion(id),
        rejectSuggestion: (id: string) => (editor.commands as any).rejectSuggestion(id),
        acceptAllSuggestions: () => (editor.commands as any).acceptAllSuggestions(),
        rejectAllSuggestions: () => (editor.commands as any).rejectAllSuggestions(),
        selectSuggestion: (id: string | null) => (editor.commands as any).selectSuggestion(id),
        focus: () => editor.commands.focus(),
        blur: () => editor.commands.blur(),
        undo: () => editor.commands.undo(),
        redo: () => editor.commands.redo(),
      },
      setEditable: (val: boolean) => editor.setEditable(val),
      getHTML: () => editor.getHTML(),
      getText: () => editor.getText(),
      state: editor.state,
    });

    editor.on('update', () => {
      bridge.send({ type: 'contentChange', content: editor.getText(), html: editor.getHTML() });
    });

    editor.on('selectionUpdate', () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        bridge.send({ type: 'selectionChange', selection: { from, to, text } });
      } else {
        bridge.send({ type: 'selectionChange', selection: null });
      }
    });

    editor.on('focus', () => bridge.send({ type: 'editorFocused' }));
    editor.on('blur', () => bridge.send({ type: 'editorBlurred' }));

    (window as any).editor = editor;
    (window as any).getAiToolkit = () => getAiToolkit(editor);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="editor-bundle">
      <EditorContent editor={editor} />
      <style>{`
        html, body, #root {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .editor-bundle {
          height: 100%;
          padding: 24px;
          box-sizing: border-box;
        }
        .editor-bundle .ProseMirror {
          outline: none;
          min-height: 100%;
        }
        .editor-bundle .ProseMirror p {
          margin: 0 0 0.5em;
        }
        .editor-bundle .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #adb5bd;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
}

function mount(container: HTMLElement, props?: EditorBundleProps) {
  const root = createRoot(container);
  root.render(<EditorBundle {...props} />);
  return root;
}

(window as any).EditorBundle = { mount, EditorBundle };

const rootEl = document.getElementById('root');
if (rootEl) {
  mount(rootEl);
}
