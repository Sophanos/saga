import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from 'convex/react';
import usePresence from '@convex-dev/presence/react';
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap';
import { generateCollaboratorColor, useEditorMetricsStore } from '@mythos/state';
import { FlowFocusExtension, TypewriterScrollExtension } from '../extensions';
import { api } from '../../../../convex/_generated/api';
import { Editor, type EditorProps } from './Editor';
import type { Editor as TiptapEditor } from '@tiptap/core';
import type { RemoteCursorUser } from '../extensions/remote-cursor';
import type { Suggestion } from '../extensions/suggestion-plugin';
import { rangeFromAnchors } from '../lib/anchors';

const DEFAULT_INITIAL_CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

type PresenceStatus = 'online' | 'typing' | 'idle';

const CURSOR_THROTTLE_MS = 350;
const TYPING_STATUS_IDLE_MS = 1500;

// Convex API types are too deep for this package; treat as untyped here.
// @ts-ignore
const apiAny: any = api;

export interface CollaborationUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface CollaborativeEditorProps
  extends Omit<
    EditorProps,
    | 'content'
    | 'extraExtensions'
    | 'remoteCursors'
    | 'currentUserId'
    | 'syncContentFromProps'
    | 'onCursorChange'
  > {
  projectId: string;
  documentId: string;
  user: CollaborationUser;
  authToken?: string | null;
  convexUrl?: string;
  presenceIntervalMs?: number;
  onSyncError?: (error: Error) => void;
}

function CollaborativeEditorInner({
  projectId: _projectId,
  documentId,
  user,
  authToken: _authToken,
  convexUrl,
  presenceIntervalMs = 10_000,
  onSyncError,
  ...editorProps
}: CollaborativeEditorProps): JSX.Element {
  const { onChange: onEditorChange, onFocusChange: onEditorFocusChange, ...restEditorProps } =
    editorProps;
  const sync = useTiptapSync(apiAny.prosemirrorSync as any, documentId, {
    onSyncError: (error) => {
      onSyncError?.(error);
      console.error('[CollaborativeEditor] Sync error:', error);
    },
  });

  const roomId = `document:${documentId}`;
  const colorRef = useRef<string>(generateCollaboratorColor());
  const createRequestedRef = useRef(false);

  // Configure flow extensions ONCE (stable reference)
  // Settings are synced via commands in the parent shell
  const flowExtensions = useMemo(() => [
    FlowFocusExtension.configure({
      focusLevel: 'none', // Initial state, updated via command
      dimOpacity: 0.3,
    }),
    TypewriterScrollExtension.configure({
      enabled: false, // Initial state, updated via command
    }),
  ], []); // Empty deps = stable reference

  // Memoize all extra extensions to prevent editor recreation
  const allExtraExtensions = useMemo(() => {
    if (!sync.extension) return flowExtensions;
    return [sync.extension, ...flowExtensions];
  }, [sync.extension, flowExtensions]);
  const updatePresence = useMutation(apiAny.presence?.update as any);
  const updateSuggestionStatus = useMutation(apiAny.suggestions?.setSuggestionStatus as any);
  const suggestions = useQuery(apiAny.suggestions?.listByDocument as any, {
    documentId,
    status: 'proposed',
    limit: 200,
  });
  const presenceState = usePresence(
    apiAny.presence as any,
    roomId,
    user.id,
    presenceIntervalMs,
    convexUrl
  );

  const pendingCursorRef = useRef<{ from: number; to: number } | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const lastSentCursorRef = useRef<{ from: number; to: number } | null>(null);
  const isFocusedRef = useRef(false);
  const statusRef = useRef<PresenceStatus>('online');

  const sendPresenceUpdate = useCallback(
    (payload: { cursor?: { from: number; to: number }; status: PresenceStatus }) => {
      updatePresence({
        roomId,
        data: {
          name: user.name,
          avatarUrl: user.avatarUrl,
          color: colorRef.current,
          documentId,
          cursor: payload.cursor,
          status: payload.status,
          isAi: false,
        },
      }).catch((error) => {
        console.error('[CollaborativeEditor] Presence update failed:', error);
      });
    },
    [updatePresence, roomId, user.name, user.avatarUrl, documentId]
  );

  const updateStatusPresence = useCallback(
    (status: PresenceStatus) => {
      if (statusRef.current === status) return;
      statusRef.current = status;
      const cursor = lastSentCursorRef.current ?? pendingCursorRef.current ?? undefined;
      sendPresenceUpdate({ status, cursor });
    },
    [sendPresenceUpdate]
  );

  const updateCursorPresence = useCallback(
    (cursor?: { from: number; to: number }) => {
      sendPresenceUpdate({ status: statusRef.current, cursor });
    },
    [sendPresenceUpdate]
  );

  const clearCursorTimer = useCallback(() => {
    if (cursorTimerRef.current !== null) {
      window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    }
  }, []);

  const clearTypingTimer = useCallback(() => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const scheduleTypingReset = useCallback(() => {
    clearTypingTimer();
    typingTimeoutRef.current = window.setTimeout(() => {
      typingTimeoutRef.current = null;
      updateStatusPresence('online');
    }, TYPING_STATUS_IDLE_MS);
  }, [clearTypingTimer, updateStatusPresence]);

  const handleFocusChange = useCallback(
    (focused: boolean) => {
      isFocusedRef.current = focused;
      onEditorFocusChange?.(focused);
      if (focused) {
        updateStatusPresence('online');
        return;
      }
      clearTypingTimer();
      pendingCursorRef.current = null;
      clearCursorTimer();
      lastSentCursorRef.current = null;
      if (presenceState === null || presenceState === undefined) {
        return;
      }
      statusRef.current = 'idle';
      sendPresenceUpdate({ status: 'idle', cursor: undefined });
    },
    [
      clearCursorTimer,
      clearTypingTimer,
      onEditorFocusChange,
      presenceState,
      sendPresenceUpdate,
      updateStatusPresence,
    ]
  );

  // Get metrics store updater
  const updateMetrics = useEditorMetricsStore((s) => s.updateMetrics);

  const handleContentChange = useCallback(
    (content: string) => {
      onEditorChange?.(content);

      // Update word count in shared metrics store
      if (editorInstance) {
        const text = editorInstance.getText();
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        updateMetrics({ wordCount });
      }

      if (!isFocusedRef.current) return;
      updateStatusPresence('typing');
      scheduleTypingReset();
    },
    [onEditorChange, scheduleTypingReset, updateStatusPresence, editorInstance, updateMetrics]
  );

  const handleCursorChange = useCallback(
    (selection: { from: number; to: number }) => {
      if (!isFocusedRef.current) return;
      if (
        lastSentCursorRef.current?.from === selection.from &&
        lastSentCursorRef.current?.to === selection.to
      ) {
        return;
      }
      pendingCursorRef.current = selection;
      if (cursorTimerRef.current !== null) return;
      cursorTimerRef.current = window.setTimeout(() => {
        const cursor = pendingCursorRef.current ?? undefined;
        pendingCursorRef.current = null;
        cursorTimerRef.current = null;
        if (!cursor) {
          updateCursorPresence(undefined);
          return;
        }
        if (
          lastSentCursorRef.current?.from === cursor.from &&
          lastSentCursorRef.current?.to === cursor.to
        ) {
          return;
        }
        lastSentCursorRef.current = cursor;
        updateCursorPresence(cursor);
      }, CURSOR_THROTTLE_MS);
    },
    [updateCursorPresence]
  );

  useEffect(() => {
    sendPresenceUpdate({ status: statusRef.current, cursor: undefined });
  }, [sendPresenceUpdate]);

  useEffect(() => {
    return () => {
      clearCursorTimer();
      clearTypingTimer();
    };
  }, [clearCursorTimer, clearTypingTimer]);

  useEffect(() => {
    if (sync.isLoading) return;
    if (sync.initialContent !== null) return;
    if (!sync.create || createRequestedRef.current) return;
    createRequestedRef.current = true;
    void sync.create(DEFAULT_INITIAL_CONTENT);
  }, [sync]);

  const remoteCursors = useMemo<RemoteCursorUser[]>(() => {
    if (!presenceState) return [];
    return presenceState
      .filter((entry) => entry.online && entry.userId !== user.id)
      .map((entry) => {
        const data = (entry.data as Record<string, unknown> | undefined) ?? {};
        return {
          id: entry.userId,
          name: (data['name'] as string | undefined) ?? entry.name ?? 'Collaborator',
          color: (data['color'] as string | undefined) ?? '#22d3ee',
          cursor: data['cursor'] as { from: number; to: number } | undefined,
          status: data['status'] as string | undefined,
          isAi: data['isAi'] as boolean | undefined,
        };
      });
  }, [presenceState, user.id]);

  const handleEditorReady = useCallback((editor: TiptapEditor | null) => {
    setEditorInstance(editor);
  }, []);

  const handleSuggestionAccepted = useCallback(
    (suggestion: Suggestion) => {
      updateSuggestionStatus({ suggestionId: suggestion.id, status: 'accepted' }).catch((error) => {
        console.error('[CollaborativeEditor] Failed to accept suggestion:', error);
      });
    },
    [updateSuggestionStatus]
  );

  const handleSuggestionRejected = useCallback(
    (suggestion: Suggestion) => {
      updateSuggestionStatus({ suggestionId: suggestion.id, status: 'rejected' }).catch((error) => {
        console.error('[CollaborativeEditor] Failed to reject suggestion:', error);
      });
    },
    [updateSuggestionStatus]
  );

  // Update word count when editor becomes ready
  useEffect(() => {
    if (!editorInstance) return;
    const text = editorInstance.getText();
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    updateMetrics({ wordCount });
  }, [editorInstance, updateMetrics]);

  useEffect(() => {
    if (!editorInstance) return;
    if (!suggestions) {
      editorInstance.commands.loadSuggestions?.([]);
      return;
    }

    const resolvedSuggestions = suggestions
      .map((suggestion: any) => {
        let range = null as { from: number; to: number } | null;

        if (suggestion.anchorStart && suggestion.anchorEnd) {
          range = rangeFromAnchors(
            editorInstance.state.doc,
            suggestion.anchorStart,
            suggestion.anchorEnd
          );
        }

        if (!range && typeof suggestion.from === 'number' && typeof suggestion.to === 'number') {
          range = { from: suggestion.from, to: suggestion.to };
        }

        if (!range) return null;

        return {
          id: suggestion.suggestionId,
          from: range.from,
          to: range.to,
          type: suggestion.type,
          content: suggestion.content,
          originalContent: suggestion.originalContent ?? undefined,
          model: suggestion.model ?? undefined,
          createdAt: new Date(suggestion.createdAt).toISOString(),
          agentId: suggestion.agentId ?? 'muse',
          anchorStart: suggestion.anchorStart ?? undefined,
          anchorEnd: suggestion.anchorEnd ?? undefined,
        } as Suggestion;
      })
      .filter(Boolean) as Suggestion[];

    editorInstance.commands.loadSuggestions?.(resolvedSuggestions);
  }, [editorInstance, suggestions]);

  if (sync.isLoading || !sync.extension || sync.initialContent === null) {
    return (
      <div className="editor-collab-loading">
        <span>Connecting editor...</span>
        <style>{`
          .editor-collab-loading {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-sans, sans-serif);
            color: var(--color-text-secondary, #6b6b6b);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div data-testid="collab-editor" style={{ height: "100%" }}>
      <Editor
        {...restEditorProps}
        content={sync.initialContent}
        extraExtensions={allExtraExtensions}
        remoteCursors={remoteCursors}
        currentUserId={user.id}
        onChange={handleContentChange}
        onCursorChange={handleCursorChange}
        onFocusChange={handleFocusChange}
        onEditorReady={handleEditorReady}
        onSuggestionAccepted={handleSuggestionAccepted}
        onSuggestionRejected={handleSuggestionRejected}
        syncContentFromProps={false}
      />
    </div>
  );
}

export function CollaborativeEditor(props: CollaborativeEditorProps): JSX.Element {
  const { convexUrl, authToken } = props;

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl, {
      skipConvexDeploymentUrlCheck: true,
    });
  }, [convexUrl]);

  useEffect(() => {
    if (!client) return;
    client.setAuth(async () => authToken ?? null);
  }, [client, authToken]);

  if (client) {
    return (
      <ConvexProvider client={client}>
        <CollaborativeEditorInner {...props} />
      </ConvexProvider>
    );
  }

  return <CollaborativeEditorInner {...props} />;
}

export default CollaborativeEditor;
