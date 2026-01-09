/**
 * Editor Bridge Protocol
 *
 * Communication protocol between the TipTap WebView editor and native apps (Tauri, React Native).
 * Uses a simple message-passing interface via `window.editorBridge`.
 *
 * Message flow:
 * - Native → WebView: `window.editorBridge.receive(message)`
 * - WebView → Native: `window.editorBridge.send(message)` (posts to native handler)
 */

import type { Suggestion, SuggestionType } from './extensions/suggestion-plugin';

// =============================================================================
// Message Types
// =============================================================================

/**
 * Messages sent FROM the editor TO native
 */
export type EditorToNativeMessage =
  // Content updates
  | { type: 'contentChange'; content: string; html: string }
  | { type: 'titleChange'; title: string }
  | { type: 'selectionChange'; selection: { from: number; to: number; text: string } | null }
  // Suggestion events
  | { type: 'reviewRequired'; suggestions: Suggestion[] }
  | { type: 'suggestionAccepted'; suggestion: Suggestion }
  | { type: 'suggestionRejected'; suggestion: Suggestion }
  | { type: 'allSuggestionsResolved' }
  // Editor state
  | { type: 'editorReady'; version: string }
  | { type: 'editorFocused' }
  | { type: 'editorBlurred' }
  // AI requests
  | { type: 'aiRequest'; selectedText: string; prompt?: string; action?: string }
  // Errors
  | { type: 'error'; code: string; message: string };

/**
 * Messages sent FROM native TO the editor
 */
export type NativeToEditorMessage =
  // Content operations
  | { type: 'setContent'; content: string }
  | { type: 'setTitle'; title: string }
  | { type: 'insertContent'; content: string; at?: number }
  | { type: 'replaceSelection'; content: string }
  // Suggestion operations
  | { type: 'addSuggestion'; suggestion: NewSuggestionPayload }
  | { type: 'acceptSuggestion'; id: string }
  | { type: 'rejectSuggestion'; id: string }
  | { type: 'acceptAllSuggestions' }
  | { type: 'rejectAllSuggestions' }
  | { type: 'selectSuggestion'; id: string | null }
  // Collaboration
  | {
      type: 'connectCollaboration';
      projectId: string;
      documentId: string;
      user: CollaborationUser;
      authToken?: string;
      convexUrl?: string;
    }
  | { type: 'disconnectCollaboration' }
  // Editor control
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'setEditable'; editable: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  // Configuration
  | { type: 'configure'; options: EditorBridgeOptions };

export interface NewSuggestionPayload {
  id: string;
  from: number;
  to: number;
  content: string;
  originalContent?: string;
  type: SuggestionType;
  model?: string;
}

export interface EditorBridgeOptions {
  placeholder?: string;
  editable?: boolean;
  fontStyle?: 'default' | 'serif' | 'mono';
}

export interface CollaborationUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

// =============================================================================
// Bridge Interface
// =============================================================================

export interface EditorBridge {
  /**
   * Protocol version for compatibility checking
   */
  version: string;

  /**
   * Send a message to native
   */
  send: (message: EditorToNativeMessage) => void;

  /**
   * Receive a message from native (called by native code)
   */
  receive: (message: NativeToEditorMessage) => void;

  /**
   * Register the editor instance
   */
  registerEditor: (editor: EditorInstance) => void;

  /**
   * Check if bridge is connected to native
   */
  isConnected: () => boolean;
}

/**
 * Minimal editor interface for bridge operations
 */
export interface EditorInstance {
  commands: {
    setContent: (content: string) => boolean;
    insertContent: (content: string) => boolean;
    insertContentAt: (pos: number, content: string) => boolean;
    addSuggestion: (suggestion: Omit<Suggestion, 'createdAt' | 'agentId'>) => boolean;
    acceptSuggestion: (id: string) => boolean;
    rejectSuggestion: (id: string) => boolean;
    acceptAllSuggestions: () => boolean;
    rejectAllSuggestions: () => boolean;
    selectSuggestion: (id: string | null) => boolean;
    focus: () => boolean;
    blur: () => boolean;
    undo: () => boolean;
    redo: () => boolean;
  };
  setEditable: (editable: boolean) => void;
  getHTML: () => string;
  getText: () => string;
  state: {
    selection: { from: number; to: number };
  };
}

// =============================================================================
// Bridge Implementation
// =============================================================================

const BRIDGE_VERSION = '1.0.0';

let registeredEditor: EditorInstance | null = null;
let messageQueue: NativeToEditorMessage[] = [];

/**
 * Native handler interface (injected by Tauri/React Native)
 */
interface NativeHandler {
  postMessage: (message: string) => void;
}

declare global {
  interface Window {
    editorBridge?: EditorBridge;
    webkit?: { messageHandlers?: { editor?: NativeHandler } }; // iOS
    editor?: NativeHandler; // Android/Tauri
    __TAURI__?: { invoke: (cmd: string, args: unknown) => Promise<unknown> }; // Tauri v2
  }
}

/**
 * Send message to native handler
 */
function sendToNative(message: EditorToNativeMessage): void {
  const messageStr = JSON.stringify(message);

  // Try different native handlers
  if (window.__TAURI__) {
    // Tauri v2
    window.__TAURI__.invoke('editor_message', { message: messageStr }).catch(console.error);
  } else if (window.webkit?.messageHandlers?.editor) {
    // iOS WebView
    window.webkit.messageHandlers.editor.postMessage(messageStr);
  } else if (window.editor?.postMessage) {
    // Android WebView or fallback
    window.editor.postMessage(messageStr);
  } else if (window.parent !== window) {
    // Running in iframe - postMessage to parent
    window.parent.postMessage({ type: 'editor-bridge-response', payload: message }, '*');
  } else {
    // Development fallback - log to console
    console.log('[EditorBridge →]', message);
  }
}

/**
 * Handle message from native
 */
function dispatchBridgeMessage(message: NativeToEditorMessage): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('editor-bridge-message', { detail: message }));
}

function handleNativeMessage(message: NativeToEditorMessage): void {
  dispatchBridgeMessage(message);

  if (!registeredEditor) {
    // Queue message if editor not ready
    messageQueue.push(message);
    return;
  }

  const editor = registeredEditor;

  switch (message.type) {
    case 'setContent':
      editor.commands.setContent(message.content);
      break;

    case 'insertContent':
      if (message.at !== undefined) {
        editor.commands.insertContentAt(message.at, message.content);
      } else {
        editor.commands.insertContent(message.content);
      }
      break;

    case 'replaceSelection':
      editor.commands.insertContent(message.content);
      break;

    case 'addSuggestion':
      editor.commands.addSuggestion({
        ...message.suggestion,
      });
      break;

    case 'acceptSuggestion':
      editor.commands.acceptSuggestion(message.id);
      break;

    case 'rejectSuggestion':
      editor.commands.rejectSuggestion(message.id);
      break;

    case 'acceptAllSuggestions':
      editor.commands.acceptAllSuggestions();
      break;

    case 'rejectAllSuggestions':
      editor.commands.rejectAllSuggestions();
      break;

    case 'selectSuggestion':
      editor.commands.selectSuggestion(message.id);
      break;

    case 'focus':
      editor.commands.focus();
      break;

    case 'blur':
      editor.commands.blur();
      break;

    case 'setEditable':
      editor.setEditable(message.editable);
      break;

    case 'undo':
      editor.commands.undo();
      break;

    case 'redo':
      editor.commands.redo();
      break;

    case 'connectCollaboration':
    case 'disconnectCollaboration':
      // Handled by host listener.
      break;

    case 'configure':
      // Handle configuration updates
      console.log('[EditorBridge] Configure:', message.options);
      break;

    default:
      console.warn('[EditorBridge] Unknown message type:', (message as { type: string }).type);
  }
}

/**
 * Create and install the editor bridge
 */
export function createEditorBridge(): EditorBridge {
  const bridge: EditorBridge = {
    version: BRIDGE_VERSION,

    send: sendToNative,

    receive: handleNativeMessage,

    registerEditor: (editor: EditorInstance) => {
      registeredEditor = editor;

      // Process queued messages
      while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (message) {
          handleNativeMessage(message);
        }
      }

      // Notify native that editor is ready
      sendToNative({ type: 'editorReady', version: BRIDGE_VERSION });
    },

    isConnected: () => {
      return !!(
        window.__TAURI__ ||
        window.webkit?.messageHandlers?.editor ||
        window.editor?.postMessage
      );
    },
  };

  // Install on window
  window.editorBridge = bridge;

  return bridge;
}

/**
 * Get the current bridge instance
 */
export function getEditorBridge(): EditorBridge | undefined {
  return window.editorBridge;
}

// =============================================================================
// React Hook
// =============================================================================

import { useEffect, useCallback } from 'react';

export interface UseEditorBridgeOptions {
  onMessage?: (message: NativeToEditorMessage) => void;
}

/**
 * React hook for using the editor bridge
 */
export function useEditorBridge(
  editor: EditorInstance | null,
  options?: UseEditorBridgeOptions
): {
  send: (message: EditorToNativeMessage) => void;
  isConnected: boolean;
} {
  useEffect(() => {
    const bridge = window.editorBridge ?? createEditorBridge();

    if (editor) {
      bridge.registerEditor(editor);
    }

    // Override receive to also call custom handler
    if (options?.onMessage) {
      const originalReceive = bridge.receive;
      bridge.receive = (message) => {
        originalReceive(message);
        options.onMessage?.(message);
      };
    }
  }, [editor, options?.onMessage]);

  const send = useCallback((message: EditorToNativeMessage) => {
    window.editorBridge?.send(message);
  }, []);

  return {
    send,
    isConnected: window.editorBridge?.isConnected() ?? false,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a suggestion payload for the bridge
 */
export function createSuggestionPayload(
  id: string,
  from: number,
  to: number,
  content: string,
  type: SuggestionType = 'insert',
  options?: { originalContent?: string; model?: string }
): NewSuggestionPayload {
  return {
    id,
    from,
    to,
    content,
    type,
    ...options,
  };
}

/**
 * Notify native about pending suggestions that need review
 */
export function notifyReviewRequired(suggestions: Suggestion[]): void {
  window.editorBridge?.send({
    type: 'reviewRequired',
    suggestions,
  });
}

/**
 * Notify native about AI content request
 */
export function requestAI(selectedText: string, prompt?: string, action?: string): void {
  window.editorBridge?.send({
    type: 'aiRequest',
    selectedText,
    prompt,
    action,
  });
}

export default createEditorBridge;

// =============================================================================
// iframe Message Listener
// =============================================================================

// Listen for postMessage from parent window (iframe mode)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'editor-bridge' && event.data?.payload) {
      const bridge = window.editorBridge;
      if (bridge) {
        bridge.receive(event.data.payload);
      }
    }
  });
}
