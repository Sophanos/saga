/**
 * Sign Up Screen
 *
 * With magic link auth, sign-up and sign-in are the same flow.
 * This screen explains the process and redirects to sign-in.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, Link } from "expo-router";
import { useTheme } from "@/design-system";
import { spacing, radii, typography } from "@/design-system/tokens";

export default function SignUpScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Mythos</Text>
        <Text style={styles.subtitle}>
          Start your creative writing journey with AI-powered insights.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <Text style={styles.infoText}>
            1. Enter your email address{"\n"}
            2. Click the magic link we send you{"\n"}
            3. Start writing!
          </Text>
          <Text style={styles.infoNote}>
            No password needed - we use secure magic links for authentication.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => router.replace("/sign-in")}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Continue to Sign In</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
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
    infoBox: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing[4],
      marginBottom: spacing[6],
    },
    infoTitle: {
      fontSize: typography.base,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing[2],
    },
    infoText: {
      fontSize: typography.sm,
      color: colors.textMuted,
      lineHeight: typography.base * 1.5,
      marginBottom: spacing[3],
    },
    infoNote: {
      fontSize: typography.xs,
      color: colors.textMuted,
      fontStyle: "italic",
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
