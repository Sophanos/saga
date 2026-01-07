/**
 * Root Layout - Entry point for Expo Router
 *
 * Includes:
 * - GestureHandlerRootView for gestures
 * - SafeAreaProvider for safe areas
 * - StatusBar configuration
 * - Convex provider (future)
 */

import { useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import { palette } from '@/design-system/colors';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Set system UI background color
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(isDark ? palette.gray[950] : palette.white);
  }, [isDark]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
          <Stack.Screen
            name="settings"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Settings',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
