import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface RemoteCursorUser {
  id: string;
  name: string;
  color: string;
  cursor?: { from: number; to: number };
  status?: string;
  isAi?: boolean;
}

export const remoteCursorPluginKey = new PluginKey('remote-cursor');

function clampPos(pos: number, max: number) {
  return Math.max(0, Math.min(pos, max));
}

function createCursorWidget(user: RemoteCursorUser) {
  const cursor = document.createElement('span');
  cursor.className = `remote-cursor${user.isAi ? ' remote-cursor--ai' : ''}`;
  cursor.style.borderColor = user.color;
  cursor.setAttribute('data-user-id', user.id);

  const label = document.createElement('span');
  label.className = 'remote-cursor__label';
  label.textContent = user.name || 'Collaborator';
  label.style.backgroundColor = user.color;
  cursor.appendChild(label);

  return cursor;
}

function buildDecorations(state: any, users: RemoteCursorUser[]) {
  const decorations: Decoration[] = [];
  const maxPos = Math.max(0, state.doc.nodeSize - 2);

  for (const user of users) {
    if (!user.cursor) continue;
    const from = clampPos(user.cursor.from, maxPos);
    const to = clampPos(user.cursor.to, maxPos);

    if (from !== to) {
      const color = user.color || '#22d3ee';
      decorations.push(
        Decoration.inline(from, to, {
          class: 'remote-selection',
          style: `background-color: ${color}33;`,
        })
      );
    }

    const cursorPos = to;
    decorations.push(
      Decoration.widget(cursorPos, () => createCursorWidget(user), {
        key: `cursor-${user.id}`,
        side: 1,
      })
    );
  }

  return DecorationSet.create(state.doc, decorations);
}

export const RemoteCursorExtension = Extension.create<{
  users: RemoteCursorUser[];
  currentUserId?: string;
}>({
  name: 'remoteCursor',

  addOptions() {
    return {
      users: [],
      currentUserId: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: remoteCursorPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, _old, _oldState, newState) => {
            const meta = tr.getMeta(remoteCursorPluginKey) as
              | { users?: RemoteCursorUser[] }
              | undefined;
            const nextUsers = meta?.users ?? this.options.users;
            const filteredUsers = this.options.currentUserId
              ? nextUsers.filter((user) => user.id !== this.options.currentUserId)
              : nextUsers;
            return buildDecorations(newState, filteredUsers);
          },
        },
        props: {
          decorations(state) {
            return remoteCursorPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});

export function updateRemoteCursors(editor: any, users: RemoteCursorUser[]) {
  if (!editor) return;
  const tr = editor.state.tr.setMeta(remoteCursorPluginKey, { users });
  editor.view.dispatch(tr);
}
