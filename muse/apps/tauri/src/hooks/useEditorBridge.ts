import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Message types matching packages/editor-webview/src/bridge.ts

export type EditorToNativeMessage =
  | { type: 'contentChange'; content: string; html: string }
  | { type: 'titleChange'; title: string }
  | { type: 'selectionChange'; selection: { from: number; to: number; text: string } | null }
  | { type: 'reviewRequired'; suggestions: unknown[] }
  | { type: 'suggestionAccepted'; suggestion: unknown }
  | { type: 'suggestionRejected'; suggestion: unknown }
  | { type: 'allSuggestionsResolved' }
  | { type: 'editorReady'; version: string }
  | { type: 'editorFocused' }
  | { type: 'editorBlurred' }
  | { type: 'aiRequest'; selectedText: string; prompt?: string; action?: string }
  | { type: 'error'; code: string; message: string };

export type NativeToEditorMessage =
  | { type: 'setContent'; content: string }
  | { type: 'setTitle'; title: string }
  | { type: 'insertContent'; content: string; at?: number }
  | { type: 'replaceSelection'; content: string }
  | { type: 'addSuggestion'; suggestion: unknown }
  | { type: 'acceptSuggestion'; id: string }
  | { type: 'rejectSuggestion'; id: string }
  | { type: 'acceptAllSuggestions' }
  | { type: 'rejectAllSuggestions' }
  | { type: 'selectSuggestion'; id: string | null }
  | {
      type: 'connectCollaboration';
      projectId: string;
      documentId: string;
      user: { id: string; name: string; avatarUrl?: string };
      authToken?: string;
      convexUrl?: string;
    }
  | { type: 'disconnectCollaboration' }
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'setEditable'; editable: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'configure'; options: Record<string, unknown> };

export interface EditorState {
  ready: boolean;
  content: string;
  html: string;
  selection: { from: number; to: number; text: string } | null;
  focused: boolean;
}

export interface UseEditorBridgeOptions {
  onMessage?: (message: EditorToNativeMessage) => void;
  onReady?: () => void;
  onContentChange?: (content: string, html: string) => void;
  onSelectionChange?: (selection: EditorState['selection']) => void;
  onAIRequest?: (selectedText: string, prompt?: string, action?: string) => void;
}

export function useEditorBridge(options: UseEditorBridgeOptions = {}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [editorState, setEditorState] = useState<EditorState>({
    ready: false,
    content: '',
    html: '',
    selection: null,
    focused: false,
  });

  // Memoize callbacks to avoid effect re-runs
  const callbacks = useMemo(
    () => ({
      onMessage: options.onMessage,
      onReady: options.onReady,
      onContentChange: options.onContentChange,
      onSelectionChange: options.onSelectionChange,
      onAIRequest: options.onAIRequest,
    }),
    [options.onMessage, options.onReady, options.onContentChange, options.onSelectionChange, options.onAIRequest]
  );

  const sendToEditor = useCallback((message: NativeToEditorMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      console.warn('[useEditorBridge] iframe not ready');
      return;
    }
    iframe.contentWindow.postMessage({ type: 'editor-bridge', payload: message }, '*');
  }, []);

  // Convenience methods
  const setContent = useCallback(
    (content: string) => sendToEditor({ type: 'setContent', content }),
    [sendToEditor]
  );

  const insertContent = useCallback(
    (content: string, at?: number) => sendToEditor({ type: 'insertContent', content, at }),
    [sendToEditor]
  );

  const focus = useCallback(() => sendToEditor({ type: 'focus' }), [sendToEditor]);
  const blur = useCallback(() => sendToEditor({ type: 'blur' }), [sendToEditor]);

  const connectCollaboration = useCallback(
    (payload: {
      projectId: string;
      documentId: string;
      user: { id: string; name: string; avatarUrl?: string };
      authToken?: string;
      convexUrl?: string;
    }) => sendToEditor({ type: 'connectCollaboration', ...payload }),
    [sendToEditor]
  );

  const disconnectCollaboration = useCallback(
    () => sendToEditor({ type: 'disconnectCollaboration' }),
    [sendToEditor]
  );

  // Listen for messages from iframe via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== 'editor-bridge-response') return;

      const message = data.payload as EditorToNativeMessage;

      switch (message.type) {
        case 'editorReady':
          setEditorState((prev) => ({ ...prev, ready: true }));
          callbacks.onReady?.();
          break;
        case 'contentChange':
          setEditorState((prev) => ({ ...prev, content: message.content, html: message.html }));
          callbacks.onContentChange?.(message.content, message.html);
          break;
        case 'selectionChange':
          setEditorState((prev) => ({ ...prev, selection: message.selection }));
          callbacks.onSelectionChange?.(message.selection);
          break;
        case 'editorFocused':
          setEditorState((prev) => ({ ...prev, focused: true }));
          break;
        case 'editorBlurred':
          setEditorState((prev) => ({ ...prev, focused: false }));
          break;
        case 'aiRequest':
          callbacks.onAIRequest?.(message.selectedText, message.prompt, message.action);
          break;
      }

      callbacks.onMessage?.(message);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [callbacks]);

  // Listen for Tauri events from Rust backend (fallback path when using __TAURI__.invoke)
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen<string>('editor-message', (event) => {
      try {
        const message = JSON.parse(event.payload) as EditorToNativeMessage;
        callbacks.onMessage?.(message);
      } catch (e) {
        console.error('[useEditorBridge] Failed to parse Tauri event:', e);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [callbacks]);

  return {
    iframeRef,
    editorState,
    sendToEditor,
    setContent,
    insertContent,
    focus,
    blur,
    connectCollaboration,
    disconnectCollaboration,
  };
}
