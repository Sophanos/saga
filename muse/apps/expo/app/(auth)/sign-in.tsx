/**
 * Sign In Screen
 *
 * Magic link and social sign in using Convex Auth.
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import { useTheme } from "@/design-system";
import { spacing, radii, typography } from "@/design-system/tokens";
import {
  useSignInWithEmail,
  useSignInWithApple,
  useSignInWithGoogle,
  useSignInWithGitHub,
} from "@/lib/auth";

type ScreenMode = "default" | "email-sent";

export default function SignInScreen() {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ScreenMode>("default");

  const signInWithEmail = useSignInWithEmail();
  const signInWithApple = useSignInWithApple();
  const signInWithGoogle = useSignInWithGoogle();
  const signInWithGitHub = useSignInWithGitHub();

  const handleEmailSignIn = async () => {
    if (!email) {
      setError("Please enter your email");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmail(email);
      setMode("email-sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send sign-in link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signInWithApple();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signInWithGitHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub sign in failed");
      setIsLoading(false);
    }
  };

  const styles = createStyles(colors, isDark);

  if (mode === "email-sent") {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a sign-in link to {email}
          </Text>
          <Text style={styles.footerText}>
            Click the link in your email to sign in. The link will expire in 10 minutes.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.socialButton]}
            onPress={() => {
              setMode("default");
              setError(null);
            }}
          >
            <Text style={[styles.socialButtonText, { color: colors.text }]}>
              Use a Different Method
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        {error && (
          <View style={styles.errorContainer} testID="auth-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={[styles.button, styles.socialButton]}
            onPress={handleGitHubSignIn}
            disabled={isLoading}
          >
            <Text style={[styles.socialButtonText, { color: colors.text }]}>
              Continue with GitHub
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.socialButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
          >
            <Text style={[styles.socialButtonText, { color: colors.text }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.button, styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

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
            testID="auth-email"
          />

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleEmailSignIn}
            disabled={isLoading}
            testID="auth-sign-in"
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send Sign-In Link</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Mythos? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Learn more</Text>
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
