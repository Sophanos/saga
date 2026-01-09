/**
 * App Layout - Main app shell with sidebar and AI panel
 *
 * This layout wraps all authenticated app screens with:
 * - Auth protection (redirects to /sign-in if not authenticated)
 * - AppShell (sidebar + AI panel on desktop)
 * - CommandPalette (⌘K)
 * - Global keyboard shortcuts
 * - Slot for rendering child routes
 */

import { useEffect } from 'react';
import { Slot, useRouter } from 'expo-router';
import { View, useColorScheme, ActivityIndicator } from 'react-native';
import { AppShell } from '@/components/layout';
import { CommandPalette } from '@/components/CommandPalette';
import { useKeyboardShortcuts } from '@/hooks';
import { palette } from '@/design-system/colors';
import { useSession } from '@/lib/auth';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // Register global keyboard shortcuts (web only)
  useKeyboardShortcuts();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace('/sign-in');
    }
  }, [session, isPending, router]);

  // Show loading while checking auth
  if (isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? palette.gray[950] : palette.white }}>
        <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
      </View>
    );
  }

  // Don't render app content if not authenticated
  if (!session?.user) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.gray[950] : palette.white }}>
      <AppShell>
        <Slot />
      </AppShell>
      <CommandPalette />
    </View>
  );
}
