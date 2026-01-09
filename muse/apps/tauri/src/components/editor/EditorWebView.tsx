import { useEffect, useMemo, useState, useCallback } from 'react';
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
  projectId?: string;
  documentId?: string;
  user?: { id: string; name: string; avatarUrl?: string };
  authToken?: string;
  convexUrl?: string;
}

export function EditorWebView({
  initialContent,
  onContentChange,
  onSelectionChange,
  onAIRequest,
  onReady,
  className = '',
  projectId,
  documentId,
  user,
  authToken,
  convexUrl,
}: EditorWebViewProps) {
  const [prodUrl, setProdUrl] = useState<string | null>(null);

  const editorUrl = isDev ? EDITOR_DEV_URL : prodUrl;

  const bridgeNonce = useMemo(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const editorOrigin = useMemo(() => {
    if (!editorUrl) return undefined;
    try {
      return new URL(editorUrl).origin;
    } catch {
      return undefined;
    }
  }, [editorUrl]);

  const hostOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;

  const bridgeOptions: UseEditorBridgeOptions = useMemo(
    () => ({
      onContentChange,
      onSelectionChange,
      onAIRequest,
      onReady,
      bridgeNonce,
      editorOrigin,
      hostOrigin,
    }),
    [onContentChange, onSelectionChange, onAIRequest, onReady, bridgeNonce, editorOrigin, hostOrigin]
  );

  const {
    iframeRef,
    editorState,
    configure,
    setContent,
    connectCollaboration,
    disconnectCollaboration,
  } = useEditorBridge(bridgeOptions);

  const shouldConnect = !!projectId && !!documentId && !!user;

  // Set initial content when editor is ready (non-collab only)
  useEffect(() => {
    if (editorState.ready && initialContent && !shouldConnect) {
      setContent(initialContent);
    }
  }, [editorState.ready, initialContent, setContent, shouldConnect]);

  useEffect(() => {
    if (!editorState.ready || !shouldConnect || !projectId || !documentId || !user) return;
    connectCollaboration({
      projectId,
      documentId,
      user,
      authToken,
      convexUrl: convexUrl ?? import.meta.env.VITE_CONVEX_URL,
    });

    return () => {
      disconnectCollaboration();
    };
  }, [
    editorState.ready,
    shouldConnect,
    projectId,
    documentId,
    user,
    authToken,
    convexUrl,
    connectCollaboration,
    disconnectCollaboration,
  ]);

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

  const handleIframeLoad = useCallback(() => {
    configure();
  }, [configure]);

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
        onLoad={handleIframeLoad}
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
