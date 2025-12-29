/**
 * Root Layout
 *
 * Main layout component that handles:
 * - Font loading
 * - Splash screen management
 * - Supabase initialization
 * - Auth gate (redirect to sign-in if not authenticated)
 * - Sync engine lifecycle management
 */

import { useEffect, useState } from "react";
import { Stack, useSegments, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator, Platform, Text, StyleSheet } from "react-native";
import { initMobileSupabase } from "../lib/supabase";
import { useSupabaseAuthSync } from "../lib/useSupabaseAuthSync";
import { useOnlineStatus, useOfflineIndicator } from "../lib/useOnlineStatus";
import { useProjectSelection } from "../lib/useProjectSelection";
import { useSyncEngine } from "../lib/useSyncEngine";
import { useProgressiveSync } from "../lib/useProgressiveSync";
import { useProjectStore } from "@mythos/state";
import { ProgressiveNudge } from "../components/progressive/ProgressiveNudge";
import { accent } from "@mythos/theme";
import "../global.css";

// Keep splash screen visible while loading fonts and checking auth
SplashScreen.preventAutoHideAsync();

// Initialize Supabase early
initMobileSupabase();

/**
 * Auth gate component that handles navigation based on auth state
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useSupabaseAuthSync();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    // Check if we're in the auth group
    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated and not in auth group - redirect to sign-in
      router.replace("/(auth)/sign-in");
    } else if (isAuthenticated && inAuthGroup) {
      // Authenticated but still in auth group - redirect to home
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, segments]);

  // Show nothing while checking auth (splash screen is still visible)
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#07070a",
        }}
      >
        <ActivityIndicator size="large" color="#e4e4e7" />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Sync status indicator component
 * Shows a small indicator when offline or syncing
 */
function SyncStatusIndicator() {
  const { isOnline, isSyncing, pendingCount, hasError } = useOfflineIndicator();

  // Don't show indicator when online and synced
  if (isOnline && !isSyncing && pendingCount === 0 && !hasError) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return accent.red; // Red for offline
    if (hasError) return accent.amber; // Amber for error
    if (isSyncing) return accent.blue; // Blue for syncing
    if (pendingCount > 0) return accent.yellow; // Yellow for pending
    return accent.green; // Green for synced
  };

  const getStatusText = () => {
    if (!isOnline) return "Offline";
    if (hasError) return "Sync Error";
    if (isSyncing) return "Syncing...";
    if (pendingCount > 0) return `${pendingCount} pending`;
    return "Synced";
  };

  return (
    <View style={[syncStyles.indicator, { backgroundColor: getStatusColor() }]}>
      <Text style={syncStyles.indicatorText}>{getStatusText()}</Text>
    </View>
  );
}

const syncStyles = StyleSheet.create({
  indicator: {
    position: "absolute",
    top: 50,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 100,
  },
  indicatorText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
});

/**
 * Sync provider component
 * Initializes and manages the sync engine lifecycle
 */
function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabaseAuthSync();
  const currentProjectId = useProjectStore((s) => s.project?.id ?? null);

  // Initialize online status monitoring
  useOnlineStatus({
    syncOnReconnect: true,
    requireInternetReachable: false,
  });

  // Initialize project selection persistence
  useProjectSelection();

  // Initialize progressive state sync from database
  useProgressiveSync(currentProjectId);

  // Initialize sync engine for current project
  const { isReady, error } = useSyncEngine({
    projectId: currentProjectId,
    userId: user?.id ?? null,
  });

  // Log sync engine status for debugging
  useEffect(() => {
    if (error) {
      console.error("[SyncProvider] Sync engine error:", error);
    } else if (isReady) {
      console.log("[SyncProvider] Sync engine ready for project:", currentProjectId);
    }
  }, [isReady, error, currentProjectId]);

  return (
    <>
      {children}
      <SyncStatusIndicator />
      <ProgressiveNudge />
    </>
  );
}

// System font fallbacks for each platform
const systemFonts = Platform.select({
  ios: {
    sans: "System",
    sansMedium: "System",
    sansBold: "System",
    mono: "Menlo",
    serif: "Georgia",
  },
  android: {
    sans: "Roboto",
    sansMedium: "Roboto",
    sansBold: "Roboto",
    mono: "monospace",
    serif: "serif",
  },
  default: {
    sans: "System",
    sansMedium: "System",
    sansBold: "System",
    mono: "monospace",
    serif: "serif",
  },
});

// Export font family names for use throughout the app
export const fontFamily = {
  sans: "DM-Sans",
  sansMedium: "DM-Sans-Medium",
  sansBold: "DM-Sans-Bold",
  mono: "JetBrains-Mono",
  serif: "Instrument-Serif",
  // Fallbacks if custom fonts fail to load
  fallback: systemFonts,
};

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);
  
  // Try to load custom fonts, but gracefully handle failures
  const [fontsLoaded, fontError] = useFonts({
    "DM-Sans": require("../assets/fonts/DMSans-Regular.ttf"),
    "DM-Sans-Medium": require("../assets/fonts/DMSans-Medium.ttf"),
    "DM-Sans-Bold": require("../assets/fonts/DMSans-Bold.ttf"),
    "JetBrains-Mono": require("../assets/fonts/JetBrainsMono-Regular.ttf"),
    "Instrument-Serif": require("../assets/fonts/InstrumentSerif-Regular.ttf"),
  });

  useEffect(() => {
    // If fonts loaded successfully or there was an error (missing fonts),
    // we proceed with system font fallbacks
    if (fontsLoaded || fontError) {
      setFontsReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Also set a timeout to ensure we don't get stuck if font loading hangs
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!fontsReady) {
        console.warn("Font loading timeout - using system fonts");
        setFontsReady(true);
        SplashScreen.hideAsync();
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <AuthGate>
        <SyncProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#07070a" },
              animation: "fade",
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="index" />
            <Stack.Screen name="projects" />
            <Stack.Screen name="world" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="editor/[id]" options={{ animation: "slide_from_right" }} />
          </Stack>
        </SyncProvider>
      </AuthGate>
    </GestureHandlerRootView>
  );
}
