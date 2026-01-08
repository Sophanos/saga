/**
 * General commands
 */

import type { Command } from './types';

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
];
