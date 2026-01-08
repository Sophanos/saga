/**
 * Navigation-related commands
 */

import type { Command } from './types';
import { useLayoutStore } from '@/design-system/layout';

export const navigationCommands: Command[] = [
  {
    id: 'nav.toggle.sidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    icon: 'sidebar',
    category: 'navigation',
    keywords: ['sidebar', 'panel', 'toggle', 'hide', 'show'],
    shortcut: '⌘B',
    execute: () => {
      useLayoutStore.getState().toggleSidebar();
    },
  },
  {
    id: 'nav.toggle.ai',
    label: 'Toggle AI Panel',
    description: 'Show or hide the AI panel',
    icon: 'message-circle',
    category: 'navigation',
    keywords: ['ai', 'chat', 'panel', 'toggle', 'muse'],
    shortcut: '⌘J',
    execute: () => {
      useLayoutStore.getState().toggleAIPanel();
    },
  },
  {
    id: 'nav.ai.side',
    label: 'AI Panel: Side',
    description: 'Dock AI panel to the side',
    icon: 'layout',
    category: 'navigation',
    keywords: ['ai', 'side', 'dock', 'panel'],
    execute: () => {
      useLayoutStore.getState().setAIPanelMode('side');
    },
  },
  {
    id: 'nav.ai.floating',
    label: 'AI Panel: Floating',
    description: 'Float the AI panel',
    icon: 'square',
    category: 'navigation',
    keywords: ['ai', 'float', 'window', 'panel'],
    execute: () => {
      useLayoutStore.getState().setAIPanelMode('floating');
    },
  },
  {
    id: 'nav.ai.full',
    label: 'AI Panel: Full Screen',
    description: 'Expand AI panel to full screen',
    icon: 'maximize-2',
    category: 'navigation',
    keywords: ['ai', 'full', 'maximize', 'panel'],
    execute: () => {
      useLayoutStore.getState().setAIPanelMode('full');
    },
  },
  {
    id: 'nav.settings',
    label: 'Open Settings',
    description: 'Open application settings',
    icon: 'settings',
    category: 'navigation',
    keywords: ['settings', 'preferences', 'config'],
    shortcut: '⌘,',
    execute: () => {
      // TODO: Navigate to settings
      console.log('Open settings');
    },
  },
];
