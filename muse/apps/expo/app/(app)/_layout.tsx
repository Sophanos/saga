/**
 * App Layout - Main app shell with sidebar and AI panel
 *
 * This layout wraps all authenticated app screens with:
 * - AppShell (sidebar + AI panel on desktop)
 * - Slot for rendering child routes
 */

import { Slot } from 'expo-router';
import { View, useColorScheme } from 'react-native';
import { AppShell } from '@/components/layout';
import { palette } from '@/design-system/colors';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.gray[950] : palette.white }}>
      <AppShell>
        <Slot />
      </AppShell>
    </View>
  );
}
