/**
 * App Layout - Main app shell with sidebar and AI panel
 *
 * This layout wraps all authenticated app screens with:
 * - AppShell (sidebar + AI panel on desktop)
 * - CommandPalette (⌘K)
 * - Global keyboard shortcuts
 * - Slot for rendering child routes
 */

import { Slot } from 'expo-router';
import { View, useColorScheme } from 'react-native';
import { AppShell } from '@/components/layout';
import { CommandPalette } from '@/components/CommandPalette';
import { useKeyboardShortcuts } from '@/hooks';
import { palette } from '@/design-system/colors';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Register global keyboard shortcuts (web only)
  useKeyboardShortcuts();

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.gray[950] : palette.white }}>
      <AppShell>
        <Slot />
      </AppShell>
      <CommandPalette />
    </View>
  );
}
