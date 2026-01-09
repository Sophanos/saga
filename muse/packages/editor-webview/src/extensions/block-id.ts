import UniqueID from '@tiptap/extension-unique-id';

const BLOCK_ID_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'listItem',
  'bulletList',
  'orderedList',
  'codeBlock',
  'table',
  'tableRow',
  'tableCell',
];

export const BlockIdExtension = UniqueID.configure({
  attributeName: 'blockId',
  types: BLOCK_ID_TYPES,
});

export type BlockAnchor = {
  blockId: string;
  offset: number;
};

export { BLOCK_ID_TYPES };
