/**
 * General commands
 */

import type { Command } from '../types';

function dispatchEditorIntent(
  eventName: string,
  detail: { source: 'command_palette' }
): boolean {
  const target = globalThis as unknown as {
    dispatchEvent?: (event: { type: string }) => boolean;
    CustomEvent?: new (
      type: string,
      init?: { detail?: unknown }
    ) => { type: string };
  };

  if (typeof target.dispatchEvent === 'function' && typeof target.CustomEvent === 'function') {
    target.dispatchEvent(new target.CustomEvent(eventName, { detail }));
    return true;
  }

  return false;
}

export const generalCommands: Command[] = [
  {
    id: 'general.search',
    label: 'Search',
    description: 'Search documents and entities',
    icon: 'search',
    category: 'general',
    keywords: ['search', 'find', 'lookup'],
    shortcut: '⌘F',
    execute: () => {
      console.log('Search');
    },
  },
  {
    id: 'general.import',
    label: 'Import Story',
    description: 'Import content from a file',
    icon: 'upload',
    category: 'general',
    keywords: ['import', 'upload', 'file', 'docx', 'epub', 'markdown', 'txt'],
    shortcut: '⌘⇧I',
    when: (ctx) => !!ctx.projectId,
    execute: () => {
      if (!dispatchEditorIntent('editor:open-import', { source: 'command_palette' })) {
        console.log('Import requested (no event target available)');
      }
    },
  },
  {
    id: 'general.export',
    label: 'Export Story',
    description: 'Export to PDF, DOCX, EPUB, or Markdown',
    icon: 'download',
    category: 'general',
    keywords: ['export', 'download', 'pdf', 'docx', 'epub', 'markdown'],
    shortcut: '⌘⇧E',
    when: (ctx) => !!ctx.projectId,
    execute: () => {
      if (!dispatchEditorIntent('editor:open-export', { source: 'command_palette' })) {
        console.log('Export requested (no event target available)');
      }
    },
  },
  {
    id: 'general.new.project',
    label: 'New Project',
    description: 'Create a new project',
    icon: 'folder-plus',
    category: 'general',
    keywords: ['new', 'project', 'create'],
    execute: () => {
      console.log('New project');
    },
  },
  {
    id: 'general.switch.project',
    label: 'Switch Project',
    description: 'Switch to another project',
    icon: 'folder',
    category: 'general',
    keywords: ['switch', 'project', 'open'],
    shortcut: '⌘O',
    execute: () => {
      console.log('Switch project');
    },
  },
  {
    id: 'general.shortcuts',
    label: 'Keyboard Shortcuts',
    description: 'View all keyboard shortcuts',
    icon: 'command',
    category: 'general',
    keywords: ['keyboard', 'shortcuts', 'keys', 'hotkeys'],
    shortcut: '⌘/',
    execute: () => {
      console.log('Show shortcuts');
    },
  },
  {
    id: 'general.theme.toggle',
    label: 'Toggle Theme',
    description: 'Switch between light and dark theme',
    icon: 'moon',
    category: 'general',
    keywords: ['theme', 'dark', 'light', 'mode'],
    execute: () => {
      console.log('Toggle theme');
    },
  },
  {
    id: 'dev.artifact.demo',
    label: 'Demo: Show Artifact Types',
    description: 'Show sample artifacts for testing',
    icon: 'layers',
    category: 'general',
    keywords: ['artifact', 'demo', 'test', 'dev'],
    execute: () => {
      // Dispatch custom event for artifact demo
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).dispatchEvent === 'function') {
        (globalThis as any).dispatchEvent(new CustomEvent('artifact:show-demo'));
      }
    },
  },
];
