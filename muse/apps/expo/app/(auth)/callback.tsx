/**
 * Auth Callback Screen
 *
 * Handles OAuth and magic link redirects and waits for Convex Auth to settle.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter, useLocalSearchParams, usePathname } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useTheme } from "@/design-system";
import { spacing, radii, typography } from "@/design-system/tokens";

const AUTH_TIMEOUT_MS = 15000;

type CallbackParams = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
};

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function LoadingState(): JSX.Element {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <ActivityIndicator size="large" color={isDark ? "#fff" : "#000"} />
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Finishing sign-in…
      </Text>
    </View>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <Text style={[styles.title, { color: colors.text }]}>Sign-in failed</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{message}</Text>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={onRetry}>
        <Text style={styles.buttonText}>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AuthCallbackScreen(): JSX.Element {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const params = useLocalSearchParams();
  const pathname = usePathname();
  const [timedOut, setTimedOut] = useState(false);
  const handledCodeRef = useRef(false);
  const hasCallbackParamsRef = useRef(false);

  const callbackParams = useMemo<CallbackParams>(() => {
    return {
      code: normalizeParam(params.code),
      state: normalizeParam(params.state),
      error: normalizeParam(params.error),
      error_description: normalizeParam(params.error_description),
    };
  }, [params.code, params.state, params.error, params.error_description]);

  const hasCallbackParams = Boolean(
    callbackParams.code || callbackParams.state || callbackParams.error
  );

  useEffect(() => {
    if (hasCallbackParams) {
      hasCallbackParamsRef.current = true;
    }
  }, [hasCallbackParams]);

  const isCallbackPath = pathname.includes("callback");
  const hasCallbackFlow = hasCallbackParamsRef.current || hasCallbackParams || isCallbackPath;

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    if (handledCodeRef.current || !callbackParams.code || callbackParams.error) {
      return;
    }

    handledCodeRef.current = true;
    const signInWithCode = signIn as (
      provider: string | undefined,
      params: { code: string }
    ) => Promise<unknown>;

    void signInWithCode(undefined, { code: callbackParams.code }).catch((error) => {
      console.error("[auth] Failed to complete native sign-in:", error);
    });
  }, [callbackParams.code, callbackParams.error, signIn]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(app)");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated || isLoading) {
      return;
    }

    if (!hasCallbackFlow) {
      router.replace("/(auth)/sign-in");
      return;
    }

    const timeoutId = setTimeout(() => {
      setTimedOut(true);
    }, AUTH_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasCallbackFlow, isAuthenticated, isLoading, router]);

  if (isLoading || (hasCallbackFlow && !timedOut && !callbackParams.error)) {
    return <LoadingState />;
  }

  if (callbackParams.error || timedOut) {
    const message =
      callbackParams.error_description ||
      callbackParams.error ||
      "We could not complete your sign-in. Please try again.";
    return (
      <ErrorState
        message={message}
        onRetry={() => {
          router.replace("/(auth)/sign-in");
        }}
      />
    );
  }

  return <LoadingState />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
    gap: spacing[3],
  },
  title: {
    fontSize: typography.xl,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.base,
    textAlign: "center",
  },
  button: {
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radii.md,
  },
  buttonText: {
    color: "#fff",
    fontSize: typography.base,
    fontWeight: "600",
  },
});
