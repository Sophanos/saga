/**
 * OAuth Callback Handler
 *
 * Handles /callback route for OAuth redirects on web.
 * This is a top-level route that matches http://localhost:PORT/callback
 */

import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { useConvexAuth } from "convex/react";
import { useTheme } from "@/design-system";

const AUTH_TIMEOUT_MS = 15000;

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default function CallbackScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const params = useLocalSearchParams();
  const pathname = usePathname();
  const [timedOut, setTimedOut] = useState(false);

  const code = normalizeParam(params.code);
  const state = normalizeParam(params.state);
  const error = normalizeParam(params.error);
  const errorDescription = normalizeParam(params.error_description);

  const hasCallbackParams = Boolean(code || state || error);

  // Debug log
  useEffect(() => {
    console.log("[callback] Route hit:", { pathname, code: !!code, state: !!state, error, isLoading, isAuthenticated });
  }, [pathname, code, state, error, isLoading, isAuthenticated]);

  // Redirect on successful auth
  useEffect(() => {
    if (isAuthenticated) {
      console.log("[callback] Authenticated, redirecting to app");
      router.replace("/(app)");
    }
  }, [isAuthenticated, router]);

  // Handle timeout and no callback params
  useEffect(() => {
    if (isAuthenticated || isLoading) {
      return;
    }

    if (!hasCallbackParams) {
      console.log("[callback] No callback params, redirecting to sign-in");
      router.replace("/(auth)/sign-in");
      return;
    }

    const timeoutId = setTimeout(() => {
      setTimedOut(true);
    }, AUTH_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [hasCallbackParams, isAuthenticated, isLoading, router]);

  // Error state
  if (error || timedOut) {
    const message = errorDescription || error || "We could not complete your sign-in. Please try again.";
    return (
      <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
        <Text style={[styles.title, { color: colors.text }]}>Sign-in failed</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{message}</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => router.replace("/(auth)/sign-in")}
        >
          <Text style={styles.buttonText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading state
  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <ActivityIndicator size="large" color={colors.text} />
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Finishing sign-in…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
