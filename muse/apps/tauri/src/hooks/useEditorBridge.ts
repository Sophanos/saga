import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

const BRIDGE_VERSION = '1.0.0';

type BridgeEnvelope<T> = {
  type: 'editor-bridge' | 'editor-bridge-response';
  payload: T;
  nonce: string;
  version: string;
};

export type BridgeConfigureOptions = {
  placeholder?: string;
  editable?: boolean;
  fontStyle?: 'default' | 'serif' | 'mono';
  bridgeNonce?: string;
  allowedOrigins?: string[];
  nativeVersion?: string;
};

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
  | { type: 'configure'; options: BridgeConfigureOptions };

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
  bridgeNonce?: string;
  editorOrigin?: string;
  hostOrigin?: string;
  expectedVersion?: string;
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

  const bridgeNonceRef = useRef<string | null>(options.bridgeNonce ?? null);
  const editorOriginRef = useRef<string | null>(options.editorOrigin ?? null);
  const hostOriginRef = useRef<string | null>(options.hostOrigin ?? null);
  const expectedVersionRef = useRef<string>(options.expectedVersion ?? BRIDGE_VERSION);
  const bridgeDisabledRef = useRef(false);
  const configuredRef = useRef(false);

  useEffect(() => {
    bridgeNonceRef.current = options.bridgeNonce ?? null;
  }, [options.bridgeNonce]);

  useEffect(() => {
    editorOriginRef.current = options.editorOrigin ?? null;
  }, [options.editorOrigin]);

  useEffect(() => {
    hostOriginRef.current = options.hostOrigin ?? null;
  }, [options.hostOrigin]);

  useEffect(() => {
    expectedVersionRef.current = options.expectedVersion ?? BRIDGE_VERSION;
  }, [options.expectedVersion]);

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

  const resolveEditorOrigin = useCallback(() => {
    if (editorOriginRef.current) return editorOriginRef.current;
    const src = iframeRef.current?.src;
    if (!src) return null;
    try {
      return new URL(src).origin;
    } catch {
      return null;
    }
  }, []);

  const isOriginAllowed = useCallback(
    (origin: string) => {
      const expected = resolveEditorOrigin();
      if (!expected) return false;
      return origin === expected;
    },
    [resolveEditorOrigin]
  );

  const postToEditor = useCallback(
    (message: NativeToEditorMessage) => {
      if (bridgeDisabledRef.current) return;

      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) {
        console.warn('[useEditorBridge] iframe not ready');
        return;
      }

      if (message.type !== 'configure' && !configuredRef.current) {
        console.warn('[useEditorBridge] Bridge not configured; dropping message');
        return;
      }

      const nonce = bridgeNonceRef.current;
      if (!nonce) {
        console.warn('[useEditorBridge] Missing bridge nonce; dropping message');
        return;
      }

      const targetOrigin = resolveEditorOrigin();
      if (!targetOrigin) {
        console.error('[useEditorBridge] Unable to resolve editor origin; dropping message');
        return;
      }

      const envelope: BridgeEnvelope<NativeToEditorMessage> = {
        type: 'editor-bridge',
        payload: message,
        nonce,
        version: expectedVersionRef.current,
      };

      iframe.contentWindow.postMessage(envelope, targetOrigin);
    },
    [resolveEditorOrigin]
  );

  const configure = useCallback(() => {
    const nonce = bridgeNonceRef.current;
    if (!nonce) {
      console.warn('[useEditorBridge] Missing bridge nonce; cannot configure');
      return;
    }

    const hostOrigin = hostOriginRef.current ?? window.location.origin;
    const optionsPayload: BridgeConfigureOptions = {
      bridgeNonce: nonce,
      allowedOrigins: hostOrigin ? [hostOrigin] : undefined,
      nativeVersion: expectedVersionRef.current,
    };

    configuredRef.current = true;
    postToEditor({ type: 'configure', options: optionsPayload });
  }, [postToEditor]);

  const sendToEditor = useCallback(
    (message: NativeToEditorMessage) => {
      postToEditor(message);
    },
    [postToEditor]
  );

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
      if (bridgeDisabledRef.current) return;
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;
      if (!isOriginAllowed(event.origin)) return;

      const data = event.data as BridgeEnvelope<EditorToNativeMessage> | undefined;
      if (!data || data.type !== 'editor-bridge-response' || !data.payload) return;

      const nonce = bridgeNonceRef.current;
      if (!nonce || data.nonce !== nonce) return;

      if (data.version !== expectedVersionRef.current) {
        bridgeDisabledRef.current = true;
        console.error(
          `[useEditorBridge] Bridge version mismatch (editor ${data.version}, native ${expectedVersionRef.current})`
        );
        return;
      }

      const message = data.payload;

      if (message.type === 'editorReady' && message.version !== expectedVersionRef.current) {
        bridgeDisabledRef.current = true;
        console.error(
          `[useEditorBridge] Editor ready version mismatch (editor ${message.version}, native ${expectedVersionRef.current})`
        );
        return;
      }

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
  }, [callbacks, isOriginAllowed]);

  // Listen for Tauri events from Rust backend (fallback path when using __TAURI__.invoke)
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen<string>('editor-message', (event) => {
      try {
        const message = JSON.parse(event.payload) as EditorToNativeMessage;
        if (message.type === 'editorReady' && message.version !== expectedVersionRef.current) {
          bridgeDisabledRef.current = true;
          console.error(
            `[useEditorBridge] Editor ready version mismatch (editor ${message.version}, native ${expectedVersionRef.current})`
          );
          return;
        }
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
    configure,
    setContent,
    insertContent,
    focus,
    blur,
    connectCollaboration,
    disconnectCollaboration,
  };
}
