/**
 * Root Layout - Entry point for Expo Router
 *
 * Includes:
 * - GestureHandlerRootView for gestures
 * - SafeAreaProvider for safe areas
 * - StatusBar configuration
 * - Convex Auth providers with platform-specific storage
 * - RevenueCat initialization
 */

import { useEffect, useState } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import { ConvexReactClient, useConvexAuth } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { palette } from '@/design-system/colors';
import { initAuth, initRevenueCat } from '@/lib/auth';
import { initAnalytics } from '@/lib/analytics';
import { initConsent } from '@/lib/consent';
import { initClarity } from '@/lib/clarity';
import { registerAllCommands } from '@mythos/commands';
import { useAuthStore } from '@mythos/auth';

// Auth storage type
type AuthStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

// Initialize Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || 'https://convex.rhei.team';
const convex = new ConvexReactClient(convexUrl, {
  skipConvexDeploymentUrlCheck: true, // Self-hosted
});

// Auth sync component - syncs Convex Auth with Zustand store
function AuthSync(): null {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    setLoading(isLoading || (isAuthenticated && currentUser === undefined));
    if (isLoading) return;

    if (isAuthenticated && currentUser) {
      setUser({
        id: currentUser._id,
        email: currentUser.email ?? "",
        name: currentUser.name ?? undefined,
        image: currentUser.image ?? undefined,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      reset();
    }
  }, [isLoading, isAuthenticated, currentUser, setUser, setLoading, reset]);

  return null;
}

// RevenueCat sync component
function RevenueCatSync(): null {
  const { useRevenueCatSync } = require('@mythos/auth/hooks');
  useRevenueCatSync();
  return null;
}

// Create platform-specific auth storage (native only - web uses default localStorage)
async function createNativeAuthStorage(): Promise<AuthStorage | null> {
  if (Platform.OS === 'web') {
    // Web uses ConvexAuthProvider's built-in localStorage - don't override
    return null;
  }
  // Native uses SecureStore
  const SecureStore = await import('expo-secure-store');
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

// Replace URL to scrub consumed auth code params (web only)
function replaceURL(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState({}, '', url);
  }
}

export default function RootLayout(): JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [storage, setStorage] = useState<AuthStorage | null | undefined>(undefined);
  const [storageReady, setStorageReady] = useState(false);

  // Initialize auth storage (native only)
  useEffect(() => {
    createNativeAuthStorage().then((s) => {
      setStorage(s);
      setStorageReady(true);
    });
  }, []);

  // Initialize services on mount
  useEffect(() => {
    initAuth();
    initRevenueCat();
    registerAllCommands();

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

  // Wait for storage check to complete before rendering auth provider
  if (!storageReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDark ? palette.gray[950] : palette.white }} />
    );
  }

  // Note: StrictMode removed to prevent double-mount issues with ConvexAuthProvider
  // which can cause "Connection lost while action was in flight" errors
  // Storage is only provided for native platforms; web uses built-in localStorage
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConvexAuthProvider
          client={convex}
          {...(storage ? { storage } : {})}
          replaceURL={replaceURL}
        >
            <AuthSync />
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
              <Stack.Screen name="index" />
              <Stack.Screen name="callback" />
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
          </ConvexAuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
  );
}
