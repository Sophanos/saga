/**
 * Global keyboard shortcuts (web only)
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useCommandPaletteStore, useLayoutStore } from '@mythos/state';

export function useKeyboardShortcuts() {
  const { toggle: toggleCommandPalette } = useCommandPaletteStore();
  const { toggleSidebar, toggleAIPanel } = useLayoutStore();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // ⌘K - Command palette
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // ⌘B or ⌘\ - Toggle sidebar
      if (isMeta && (e.key === 'b' || e.key === '\\')) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // ⌘J - Toggle AI panel
      if (isMeta && e.key === 'j') {
        e.preventDefault();
        toggleAIPanel();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleCommandPalette, toggleSidebar, toggleAIPanel]);
}
