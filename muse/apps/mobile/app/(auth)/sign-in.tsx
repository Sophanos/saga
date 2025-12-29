/**
 * Native Sign-In Screen
 *
 * Authentication screen with:
 * - Google Sign-In via expo-auth-session
 * - Apple Sign-In via expo-apple-authentication
 * - Dark theme matching the app design (#07070a background)
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { BookOpen } from "lucide-react-native";
import { getMobileSupabase } from "../../lib/supabase";

// Required for expo-auth-session
WebBrowser.maybeCompleteAuthSession();

/**
 * Sign-in button component with consistent styling
 */
function SignInButton({
  onPress,
  label,
  icon,
  isLoading,
  disabled,
  variant = "default",
}: {
  onPress: () => void;
  label: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: "default" | "apple";
}) {
  const bgColor = variant === "apple" ? "bg-white" : "bg-bg-secondary";
  const textColor = variant === "apple" ? "text-black" : "text-text-primary";
  const borderColor = variant === "apple" ? "border-white" : "border-border";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      className={`flex-row items-center justify-center gap-3 px-6 py-4 rounded-xl border ${borderColor} ${bgColor} ${
        disabled ? "opacity-50" : "active:opacity-80"
      }`}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "apple" ? "#000" : "#fff"}
        />
      ) : (
        <>
          {icon}
          <Text className={`text-base font-medium ${textColor}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function SignInScreen() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  // Email/password form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");

  // Google OAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  // Check Apple Sign-In availability
  useEffect(() => {
    const checkAppleAvailability = async () => {
      if (Platform.OS === "ios") {
        const available = await AppleAuthentication.isAvailableAsync();
        setIsAppleAvailable(available);
      }
    };
    checkAppleAvailability();
  }, []);

  // Handle Google OAuth response
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === "success") {
        setIsGoogleLoading(true);
        try {
          const { id_token } = response.params;

          if (!id_token) {
            throw new Error("No ID token received from Google");
          }

          const supabase = getMobileSupabase();
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: id_token,
          });

          if (error) {
            throw error;
          }

          if (data.session) {
            // Navigation will be handled by auth gate in _layout.tsx
            console.log("[Auth] Google sign-in successful");
          }
        } catch (err) {
          console.error("[Auth] Google sign-in error:", err);
          Alert.alert(
            "Sign-In Failed",
            err instanceof Error ? err.message : "Failed to sign in with Google"
          );
        } finally {
          setIsGoogleLoading(false);
        }
      } else if (response?.type === "error") {
        console.error("[Auth] Google OAuth error:", response.error);
        Alert.alert("Sign-In Error", "Google sign-in was cancelled or failed");
      }
    };

    handleGoogleResponse();
  }, [response]);

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    if (!request) {
      Alert.alert(
        "Configuration Error",
        "Google Sign-In is not properly configured"
      );
      return;
    }

    try {
      await promptAsync();
    } catch (err) {
      console.error("[Auth] Failed to prompt Google auth:", err);
    }
  };

  // Handle Apple Sign-In
  const handleAppleSignIn = async () => {
    if (!isAppleAvailable) {
      Alert.alert("Not Available", "Apple Sign-In is not available on this device");
      return;
    }

    setIsAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }

      const supabase = getMobileSupabase();
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        // Navigation will be handled by auth gate in _layout.tsx
        console.log("[Auth] Apple sign-in successful");
      }
    } catch (err: unknown) {
      // Check if user cancelled
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "ERR_REQUEST_CANCELED"
      ) {
        console.log("[Auth] Apple sign-in cancelled by user");
        return;
      }

      console.error("[Auth] Apple sign-in error:", err);
      Alert.alert(
        "Sign-In Failed",
        err instanceof Error ? err.message : "Failed to sign in with Apple"
      );
    } finally {
      setIsAppleLoading(false);
    }
  };

  // Handle email sign-in
  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter both email and password");
      return;
    }

    setIsEmailLoading(true);
    try {
      const supabase = getMobileSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        console.log("[Auth] Email sign-in successful");
      }
    } catch (err) {
      console.error("[Auth] Email sign-in error:", err);
      Alert.alert(
        "Sign-In Failed",
        err instanceof Error ? err.message : "Failed to sign in with email"
      );
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Handle email sign-up
  const handleEmailSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter both email and password");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters");
      return;
    }

    setIsEmailLoading(true);
    try {
      const supabase = getMobileSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim() || undefined,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        console.log("[Auth] Email sign-up successful");
      } else if (data.user && !data.session) {
        Alert.alert(
          "Check Your Email",
          "We've sent you a confirmation link. Please check your email to complete sign-up."
        );
      }
    } catch (err) {
      console.error("[Auth] Email sign-up error:", err);
      Alert.alert(
        "Sign-Up Failed",
        err instanceof Error ? err.message : "Failed to sign up"
      );
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Handle password reset request
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter your email address");
      return;
    }

    setIsEmailLoading(true);
    try {
      const supabase = getMobileSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // For mobile, we redirect to a web URL that handles the reset
        redirectTo: "https://mythos.app/auth/callback",
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        "Check Your Email",
        "We've sent you a password reset link. Please check your email to reset your password.",
        [{ text: "OK", onPress: () => setAuthMode("signin") }]
      );
    } catch (err) {
      console.error("[Auth] Password reset error:", err);
      Alert.alert(
        "Reset Failed",
        err instanceof Error ? err.message : "Failed to send reset email"
      );
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Combined submit handler
  const handleEmailSubmit = () => {
    if (authMode === "signin") {
      handleEmailSignIn();
    } else if (authMode === "signup") {
      handleEmailSignUp();
    } else {
      handleForgotPassword();
    }
  };

  const isAnyLoading = isGoogleLoading || isAppleLoading || isEmailLoading;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="flex-1 justify-center px-6">
        {/* Logo & Title */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="items-center mb-12"
        >
          <View className="w-20 h-20 rounded-2xl bg-bg-secondary border border-border items-center justify-center mb-6">
            <BookOpen size={40} color="#e4e4e7" />
          </View>
          <Text className="text-3xl font-bold text-text-primary mb-2">
            Welcome to Mythos
          </Text>
          <Text className="text-base text-text-secondary text-center">
            Sign in to sync your stories across devices
          </Text>
        </Animated.View>

        {/* Sign-In Buttons */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          className="gap-4"
        >
          {/* Google Sign-In */}
          <SignInButton
            onPress={handleGoogleSignIn}
            label="Continue with Google"
            icon={<GoogleIcon />}
            isLoading={isGoogleLoading}
            disabled={isAnyLoading || !request}
          />

          {/* Apple Sign-In (iOS only) */}
          {Platform.OS === "ios" && isAppleAvailable && (
            <SignInButton
              onPress={handleAppleSignIn}
              label="Continue with Apple"
              icon={<AppleIcon />}
              isLoading={isAppleLoading}
              disabled={isAnyLoading}
              variant="apple"
            />
          )}
        </Animated.View>

        {/* Divider */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(500)}
          className="flex-row items-center my-6"
        >
          <View className="flex-1 h-px bg-border" />
          <Text className="px-4 text-xs text-text-muted uppercase">
            or continue with email
          </Text>
          <View className="flex-1 h-px bg-border" />
        </Animated.View>

        {/* Email/Password Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          className="gap-4"
        >
          {/* Name field (signup only) */}
          {authMode === "signup" && (
            <TextInput
              placeholder="Your name"
              placeholderTextColor="#71717a"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!isAnyLoading}
              className="h-12 px-4 rounded-xl border border-border bg-bg-secondary text-text-primary"
            />
          )}

          {/* Email field */}
          <TextInput
            placeholder="Email address"
            placeholderTextColor="#71717a"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isAnyLoading}
            className="h-12 px-4 rounded-xl border border-border bg-bg-secondary text-text-primary"
          />

          {/* Password field (not shown in forgot mode) */}
          {authMode !== "forgot" && (
            <TextInput
              placeholder="Password"
              placeholderTextColor="#71717a"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!isAnyLoading}
              className="h-12 px-4 rounded-xl border border-border bg-bg-secondary text-text-primary"
            />
          )}

          {/* Forgot password link (signin mode only) */}
          {authMode === "signin" && (
            <Pressable
              onPress={() => setAuthMode("forgot")}
              disabled={isAnyLoading}
              className="py-1"
            >
              <Text className="text-sm text-text-muted text-right">
                Forgot password?
              </Text>
            </Pressable>
          )}

          {/* Submit button */}
          <Pressable
            onPress={handleEmailSubmit}
            disabled={isAnyLoading}
            className={`h-12 rounded-xl bg-white items-center justify-center ${
              isAnyLoading ? "opacity-50" : "active:opacity-80"
            }`}
          >
            {isEmailLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text className="text-base font-medium text-black">
                {authMode === "signin" ? "Sign in" : authMode === "signup" ? "Create account" : "Send Reset Link"}
              </Text>
            )}
          </Pressable>

          {/* Mode toggle */}
          <Pressable
            onPress={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
            disabled={isAnyLoading}
            className="py-2"
          >
            <Text className="text-sm text-text-muted text-center">
              {authMode === "forgot" ? (
                <>Remember your password? <Text className="text-text-primary font-medium">Sign in</Text></>
              ) : authMode === "signin" ? (
                <>Don't have an account? <Text className="text-text-primary font-medium">Sign up</Text></>
              ) : (
                <>Already have an account? <Text className="text-text-primary font-medium">Sign in</Text></>
              )}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Terms */}
        <Animated.View
          entering={FadeInDown.delay(250).duration(500)}
          className="mt-6"
        >
          <Text className="text-xs text-text-muted text-center leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </Animated.View>

        {/* Skip for now (development only) */}
        {__DEV__ && (
          <Animated.View
            entering={FadeInDown.delay(300).duration(500)}
            className="mt-8"
          >
            <Pressable
              onPress={() => router.replace("/")}
              className="py-3"
            >
              <Text className="text-sm text-text-muted text-center underline">
                Skip for now (dev only)
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * Google logo icon component
 */
function GoogleIcon() {
  return (
    <View className="w-5 h-5 items-center justify-center">
      <Text className="text-lg">G</Text>
    </View>
  );
}

/**
 * Apple logo icon component
 */
function AppleIcon() {
  return (
    <View className="w-5 h-5 items-center justify-center">
      <Text className="text-lg text-black"></Text>
    </View>
  );
}
