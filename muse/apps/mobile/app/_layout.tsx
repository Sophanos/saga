/**
 * Root Layout
 *
 * Main layout component that handles:
 * - Font loading
 * - Splash screen management
 * - Supabase initialization
 * - Auth gate (redirect to sign-in if not authenticated)
 */

import { useEffect } from "react";
import { Stack, useSegments, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, ActivityIndicator } from "react-native";
import { initMobileSupabase } from "../lib/supabase";
import { useSupabaseAuthSync } from "../lib/useSupabaseAuthSync";
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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "DM-Sans": require("../assets/fonts/DMSans-Regular.ttf"),
    "DM-Sans-Medium": require("../assets/fonts/DMSans-Medium.ttf"),
    "DM-Sans-Bold": require("../assets/fonts/DMSans-Bold.ttf"),
    "JetBrains-Mono": require("../assets/fonts/JetBrainsMono-Regular.ttf"),
    "Instrument-Serif": require("../assets/fonts/InstrumentSerif-Regular.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <AuthGate>
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
        </Stack>
      </AuthGate>
    </GestureHandlerRootView>
  );
}
