/**
 * Sign In Screen
 *
 * Email/password and social sign in.
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useTheme } from "@/design-system";
import { spacing, radii, typography } from "@/design-system/tokens";
import {
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
  useSession,
} from "@/lib/auth";

export default function SignInScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signInSuccess, setSignInSuccess] = useState(false);

  // Navigate when session is established after successful sign-in
  // This prevents race condition where navigation happens before session state updates
  useEffect(() => {
    if (signInSuccess && session?.user) {
      router.replace("/");
    }
  }, [signInSuccess, session, router]);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithEmail(email, password);
      if (result.error) {
        setError(result.error.message);
        setIsLoading(false);
      } else {
        // Mark sign-in as successful - navigation will happen in useEffect
        // when session state is properly updated
        setSignInSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signInWithApple();
      // OAuth will redirect back via deep link
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apple sign in failed");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signInWithGoogle();
      // OAuth will redirect back via deep link
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
      setIsLoading(false);
    }
  };

  const styles = createStyles(colors, isDark);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleEmailSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.button, styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.socialButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Text style={[styles.socialButtonText, { color: colors.text }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgApp,
    },
    content: {
      flex: 1,
      padding: spacing[6],
      justifyContent: "center",
    },
    title: {
      fontSize: typography["2xl"],
      fontWeight: "700",
      color: colors.text,
      marginBottom: spacing[2],
    },
    subtitle: {
      fontSize: typography.base,
      color: colors.textMuted,
      marginBottom: spacing[6],
    },
    errorContainer: {
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.1)",
      padding: spacing[3],
      borderRadius: radii.md,
      marginBottom: spacing[4],
    },
    errorText: {
      color: "#ef4444",
      fontSize: typography.sm,
    },
    form: {
      gap: spacing[3],
    },
    input: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing[3],
      fontSize: typography.base,
      color: colors.text,
    },
    button: {
      padding: spacing[3],
      borderRadius: radii.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    primaryButton: {
      backgroundColor: colors.accent,
    },
    buttonText: {
      color: "#fff",
      fontSize: typography.base,
      fontWeight: "600",
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: spacing[6],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textMuted,
      marginHorizontal: spacing[3],
      fontSize: typography.sm,
    },
    socialButtons: {
      gap: spacing[3],
    },
    socialButton: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    appleButton: {
      backgroundColor: isDark ? "#fff" : "#000",
    },
    socialButtonText: {
      fontSize: typography.base,
      fontWeight: "500",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: spacing[6],
    },
    footerText: {
      color: colors.textMuted,
      fontSize: typography.sm,
    },
    footerLink: {
      color: colors.accent,
      fontSize: typography.sm,
      fontWeight: "500",
    },
  });
}
