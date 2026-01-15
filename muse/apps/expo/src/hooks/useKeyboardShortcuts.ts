/**
 * Global keyboard shortcuts (web only)
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useCommandPaletteStore, useLayoutStore, useFlowStore, useArtifactStore } from '@mythos/state';

// Demo artifacts for testing
const DEMO_ARTIFACTS = [
  {
    type: 'diagram' as const,
    title: 'Character Relationships',
    content: 'Elena -->|trusts| Marcus\nMarcus -->|betrays| Elena\nElena -->|seeks help| Varen\nVaren -.->|mentors| Elena',
    format: 'mermaid' as const,
  },
  {
    type: 'timeline' as const,
    title: 'War of Shadows',
    content: JSON.stringify([
      { year: 1, event: 'The Sundering begins' },
      { year: 3, event: 'Fall of the Eastern Kingdom' },
      { year: 7, event: 'Elena born in refugee camp' },
      { year: 12, event: 'Treaty of Thornfield' },
      { year: 24, event: 'Present day' },
    ]),
    format: 'json' as const,
  },
  {
    type: 'entity' as const,
    title: 'Lord Varen',
    content: JSON.stringify({
      age: 67,
      role: 'Mentor',
      description: 'Silver-haired nobleman, one blind eye',
      goals: ['Protect Elena', 'Restore the old ways'],
      fears: ['Dying before redemption'],
    }),
    format: 'json' as const,
  },
  {
    type: 'table' as const,
    title: 'Noble Houses',
    content: '| House | Motto | Status |\n|-------|-------|--------|\n| Varen | Truth Endures | Allied |\n| Thorne | By Blood Risen | Enemy |\n| Ashford | Light in Darkness | Neutral |',
    format: 'markdown' as const,
  },
  {
    type: 'prose' as const,
    title: 'Opening Scene Draft',
    content: 'The dragon\'s scales shimmered like molten copper in the dying light. Elena\'s breath caught—years of training, yet nothing prepared her for the sheer presence of the creature before her.\n\n"You seek the old magic," it said, voice like grinding stone. "But are you prepared for what it demands?"',
    format: 'markdown' as const,
  },
  {
    type: 'code' as const,
    title: 'Magic System Rules',
    content: '// The Three Laws of Binding\n1. Blood freely given strengthens the bond\n2. Names spoken thrice cannot be unspoken\n3. No binding survives the death of both parties\n\n// Exception: Royal bloodlines are immune to the Third Law',
    format: 'plain' as const,
  },
];

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { toggle: toggleCommandPalette } = useCommandPaletteStore();
  const { toggleSidebar, toggleAIPanel } = useLayoutStore();
  const { toggleFlowMode, enabled: flowEnabled } = useFlowStore();
  const { togglePanel: toggleArtifactPanel, showArtifact } = useArtifactStore();

  // Listen for artifact demo event
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let demoIndex = 0;
    const handleArtifactDemo = () => {
      const demo = DEMO_ARTIFACTS[demoIndex % DEMO_ARTIFACTS.length];
      showArtifact(demo);
      demoIndex++;
    };

    window.addEventListener('artifact:show-demo', handleArtifactDemo);
    return () => window.removeEventListener('artifact:show-demo', handleArtifactDemo);
  }, [showArtifact]);

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

      // ⌘. - Toggle Artifact panel
      if (isMeta && e.key === '.') {
        e.preventDefault();
        toggleArtifactPanel();
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
  }, [router, toggleCommandPalette, toggleSidebar, toggleAIPanel, toggleArtifactPanel, toggleFlowMode]);
}
