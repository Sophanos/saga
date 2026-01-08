import { useEffect, useMemo, useState } from 'react';
import { resolveResource } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  useEditorBridge,
  type UseEditorBridgeOptions,
  type EditorState,
} from '../../hooks/useEditorBridge';

const isDev = import.meta.env.DEV;
const EDITOR_DEV_URL = 'http://localhost:5173';

export interface EditorWebViewProps {
  initialContent?: string;
  onContentChange?: (content: string, html: string) => void;
  onSelectionChange?: (selection: EditorState['selection']) => void;
  onAIRequest?: (selectedText: string, prompt?: string, action?: string) => void;
  onReady?: () => void;
  className?: string;
}

export function EditorWebView({
  initialContent,
  onContentChange,
  onSelectionChange,
  onAIRequest,
  onReady,
  className = '',
}: EditorWebViewProps) {
  const [prodUrl, setProdUrl] = useState<string | null>(null);

  const bridgeOptions: UseEditorBridgeOptions = useMemo(
    () => ({ onContentChange, onSelectionChange, onAIRequest, onReady }),
    [onContentChange, onSelectionChange, onAIRequest, onReady]
  );

  const { iframeRef, editorState, setContent } = useEditorBridge(bridgeOptions);

  // Set initial content when editor is ready
  useEffect(() => {
    if (editorState.ready && initialContent) {
      setContent(initialContent);
    }
  }, [editorState.ready, initialContent, setContent]);

  // For production, resolve resource path
  useEffect(() => {
    if (isDev) return;

    resolveResource('resources/editor/editor.html')
      .then((path) => {
        const assetUrl = convertFileSrc(path);
        setProdUrl(assetUrl);
      })
      .catch((err) => {
        console.error('[EditorWebView] Failed to resolve resource:', err);
      });
  }, []);

  const editorUrl = isDev ? EDITOR_DEV_URL : prodUrl;

  if (!editorUrl) {
    return (
      <div className={`editor-webview editor-webview--loading ${className}`}>
        <span>Loading editor...</span>
      </div>
    );
  }

  return (
    <div className={`editor-webview ${className}`}>
      <iframe
        ref={iframeRef}
        src={editorUrl}
        title="Mythos Editor"
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'var(--mythos-bg, #1a1a1a)',
        }}
      />
      <style>{`
        .editor-webview {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .editor-webview--loading {
          align-items: center;
          justify-content: center;
          color: var(--mythos-text-secondary, #888);
        }
      `}</style>
    </div>
  );
}

export default EditorWebView;
