/**
 * Sign Up Screen
 *
 * Create a new account with email/password.
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
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useTheme } from "@/design-system";
import { spacing, radii, typography } from "@/design-system/tokens";
import { signUpWithEmail, useSession } from "@/lib/auth";

export default function SignUpScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  // Navigate when session is established after successful sign-up
  // This prevents race condition where navigation happens before session state updates
  useEffect(() => {
    if (signUpSuccess && session?.user) {
      router.replace("/");
    }
  }, [signUpSuccess, session, router]);

  const handleSignUp = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signUpWithEmail(email, password, name);
      if (result.error) {
        setError(result.error.message ?? "Sign up failed");
        setIsLoading(false);
      } else {
        // Mark sign-up as successful - navigation will happen in useEffect
        // when session state is properly updated
        setSignUpSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your creative journey</Text>

        {error && (
          <View style={styles.errorContainer} testID="auth-error">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Name (optional)"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            testID="auth-name"
          />
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
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            testID="auth-password"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            testID="auth-password-confirm"
          />

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSignUp}
            disabled={isLoading}
            testID="auth-sign-up"
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <Text style={styles.terms}>
          By creating an account, you agree to our Terms of Service and Privacy
          Policy.
        </Text>
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
      backgroundColor: isDark
        ? "rgba(239, 68, 68, 0.1)"
        : "rgba(239, 68, 68, 0.1)",
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
      marginTop: spacing[2],
    },
    buttonText: {
      color: "#fff",
      fontSize: typography.base,
      fontWeight: "600",
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
    terms: {
      color: colors.textMuted,
      fontSize: typography.xs,
      textAlign: "center",
      marginTop: spacing[6],
      lineHeight: typography.xs * 1.5,
    },
  });
}
