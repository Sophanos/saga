/**
 * Root Layout - Entry point for Expo Router
 *
 * Includes:
 * - GestureHandlerRootView for gestures
 * - SafeAreaProvider for safe areas
 * - StatusBar configuration
 * - Convex + Better Auth providers
 * - RevenueCat initialization
 */

import { useEffect, StrictMode } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import { ConvexReactClient, ConvexProvider } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { palette } from '@/design-system/colors';
import { authClient, initAuth, initRevenueCat } from '@/lib/auth';
import { initAnalytics } from '@/lib/analytics';
import { initConsent } from '@/lib/consent';
import { initClarity } from '@/lib/clarity';

// Initialize Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || 'https://convex.cascada.vision';
const convex = new ConvexReactClient(convexUrl, {
  skipConvexDeploymentUrlCheck: true, // Self-hosted
});

// RevenueCat sync component
function RevenueCatSync() {
  const { useRevenueCatSync } = require('@mythos/auth/hooks');
  useRevenueCatSync();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Initialize services on mount
  useEffect(() => {
    initAuth();
    initRevenueCat();

    // Initialize consent first, then analytics/clarity based on consent
    initConsent().then(() => {
      // Analytics and Clarity will respect consent state via adapters
      initAnalytics();
      initClarity();
    });
  }, []);

  // Set system UI background color
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(isDark ? palette.gray[950] : palette.white);
  }, [isDark]);

  return (
    <StrictMode>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ConvexProvider client={convex}>
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
              <RevenueCatSync />
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: isDark ? palette.gray[950] : palette.white,
                  },
                  // Native-like animations
                  animation: Platform.select({
                    ios: 'default',
                    android: 'fade_from_bottom',
                    default: 'none',
                  }),
                }}
              >
                <Stack.Screen name="(app)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen
                  name="settings"
                  options={{
                    presentation: 'modal',
                    headerShown: true,
                    title: 'Settings',
                  }}
                />
              </Stack>
            </ConvexBetterAuthProvider>
          </ConvexProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StrictMode>
  );
}
