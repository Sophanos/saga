import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { BlockAnchor } from '../extensions/block-id';

function findAnchorAtPosition(doc: ProseMirrorNode, pos: number): BlockAnchor | null {
  const resolved = doc.resolve(pos);
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const node = resolved.node(depth);
    const blockId = node.attrs?.['blockId'] as string | undefined;
    if (!blockId) continue;
    const start = resolved.start(depth);
    const offset = Math.max(0, Math.min(pos - start, node.content.size));
    return { blockId, offset };
  }
  return null;
}

export function anchorsFromRange(
  editor: Editor,
  from: number,
  to: number
): { anchorStart: BlockAnchor; anchorEnd: BlockAnchor } | null {
  const anchorStart = findAnchorAtPosition(editor.state.doc, from);
  const anchorEnd = findAnchorAtPosition(editor.state.doc, to);

  if (!anchorStart || !anchorEnd) return null;

  return { anchorStart, anchorEnd };
}

function resolveAnchor(doc: ProseMirrorNode, anchor: BlockAnchor): number | null {
  let resolvedPos: number | null = null;

  doc.descendants((node, pos) => {
    if (node.attrs?.['blockId'] !== anchor.blockId) return true;
    const contentStart = pos + 1;
    const contentEnd = contentStart + node.content.size;
    const target = contentStart + anchor.offset;
    resolvedPos = Math.max(contentStart, Math.min(contentEnd, target));
    return false;
  });

  return resolvedPos;
}

export function rangeFromAnchors(
  doc: ProseMirrorNode,
  anchorStart: BlockAnchor,
  anchorEnd: BlockAnchor
): { from: number; to: number } | null {
  const from = resolveAnchor(doc, anchorStart);
  const to = resolveAnchor(doc, anchorEnd);

  if (from === null || to === null) return null;

  return from <= to ? { from, to } : { from: to, to: from };
}
