import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ConvexProvider, ConvexReactClient, useMutation } from 'convex/react';
import usePresence from '@convex-dev/presence/react';
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap';
import { generateCollaboratorColor } from '@mythos/state';
import { api } from '../../../../convex/_generated/api';
import { Editor, type EditorProps } from './Editor';
import type { RemoteCursorUser } from '../extensions/remote-cursor';

const DEFAULT_INITIAL_CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

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
}

function CollaborativeEditorInner({
  projectId: _projectId,
  documentId,
  user,
  authToken: _authToken,
  convexUrl,
  presenceIntervalMs = 10_000,
  ...editorProps
}: CollaborativeEditorProps) {
  const sync = useTiptapSync(api.prosemirrorSync, documentId, {
    onSyncError: (error) => {
      console.error('[CollaborativeEditor] Sync error:', error);
    },
  });

  const roomId = `document:${documentId}`;
  const colorRef = useRef<string>(generateCollaboratorColor());
  const createRequestedRef = useRef(false);
  const updatePresence = useMutation(api.presence.update);
  const presenceState = usePresence(
    api.presence,
    roomId,
    user.id,
    presenceIntervalMs,
    convexUrl
  );

  const updatePresenceData = useCallback(
    (cursor?: { from: number; to: number }) => {
      updatePresence({
        roomId,
        data: {
          name: user.name,
          avatarUrl: user.avatarUrl,
          color: colorRef.current,
          documentId,
          cursor,
          status: 'online',
          isAi: false,
        },
      }).catch((error) => {
        console.error('[CollaborativeEditor] Presence update failed:', error);
      });
    },
    [updatePresence, roomId, user.name, user.avatarUrl, documentId]
  );

  const pendingCursorRef = useRef<{ from: number; to: number } | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const lastSentCursorRef = useRef<{ from: number; to: number } | null>(null);
  const isFocusedRef = useRef(false);

  const handleFocusChange = useCallback(
    (focused: boolean) => {
      isFocusedRef.current = focused;
      if (!focused) {
        pendingCursorRef.current = null;
        if (cursorTimerRef.current !== null) {
          window.clearTimeout(cursorTimerRef.current);
          cursorTimerRef.current = null;
        }
        lastSentCursorRef.current = null;
        updatePresenceData(undefined);
      }
    },
    [updatePresenceData]
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
          updatePresenceData(undefined);
          return;
        }
        if (
          lastSentCursorRef.current?.from === cursor.from &&
          lastSentCursorRef.current?.to === cursor.to
        ) {
          return;
        }
        lastSentCursorRef.current = cursor;
        updatePresenceData(cursor);
      }, 350);
    },
    [updatePresenceData]
  );

  useEffect(() => {
    updatePresenceData();
  }, [updatePresenceData]);

  useEffect(() => {
    return () => {
      if (cursorTimerRef.current) {
        window.clearTimeout(cursorTimerRef.current);
      }
    };
  }, []);

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
          name: (data.name as string | undefined) ?? entry.name ?? 'Collaborator',
          color: (data.color as string | undefined) ?? '#22d3ee',
          cursor: data.cursor as { from: number; to: number } | undefined,
          status: data.status as string | undefined,
          isAi: data.isAi as boolean | undefined,
        };
      });
  }, [presenceState, user.id]);

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
    <Editor
      {...editorProps}
      content={sync.initialContent}
      extraExtensions={[sync.extension]}
      remoteCursors={remoteCursors}
      currentUserId={user.id}
      onCursorChange={handleCursorChange}
      onFocusChange={handleFocusChange}
      syncContentFromProps={false}
    />
  );
}

export function CollaborativeEditor(props: CollaborativeEditorProps) {
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
