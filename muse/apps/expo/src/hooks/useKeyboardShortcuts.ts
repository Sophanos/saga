/**
 * Global keyboard shortcuts (web only)
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCommandPaletteStore, useLayoutStore, useFlowStore } from '@mythos/state';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { toggle: toggleCommandPalette } = useCommandPaletteStore();
  const { toggleSidebar, toggleAIPanel } = useLayoutStore();
  const { toggleFlowMode, enabled: flowEnabled } = useFlowStore();

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

      // ⌘G - Project graph
      if (isMeta && e.key === 'g') {
        e.preventDefault();
        router.push('/project-graph');
        return;
      }

      // ⌘⇧Enter - Toggle Flow Mode
      if (isMeta && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        toggleFlowMode();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router, toggleCommandPalette, toggleSidebar, toggleAIPanel, toggleFlowMode]);
}
