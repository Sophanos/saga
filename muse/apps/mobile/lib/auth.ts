/**
 * Mobile auth (BetterAuth)
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { initAuthConfig, setPlatform } from "@mythos/auth";
import {
  getExpoAuthClient,
  signInWithEmail as expoSignInWithEmail,
  signInWithSocial,
  signOut as expoSignOut,
  signUpWithEmail as expoSignUpWithEmail,
} from "@mythos/auth/expo";
import { useAuthLoading, useIsAuthenticated, useUser } from "@mythos/auth/hooks";

const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
setPlatform(platform);

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || "https://cascada.vision";
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || "https://convex.cascada.vision";
const schemeValue = Constants.expoConfig?.scheme;
const scheme = Array.isArray(schemeValue) ? schemeValue[0] : schemeValue ?? "mythos";

export function initAuth(): void {
  initAuthConfig({
    convexSiteUrl: CONVEX_SITE_URL,
    convexUrl: CONVEX_URL,
    scheme,
    environment: __DEV__ ? "development" : "production",
  });
}

export async function getAuthClient() {
  return getExpoAuthClient();
}

export function useMobileAuth() {
  const user = useUser();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthLoading();

  return {
    user,
    isAuthenticated,
    isLoading,
    signOut,
  };
}

export async function signInWithEmail(email: string, password: string) {
  return expoSignInWithEmail(email, password);
}

export async function signUpWithEmail(email: string, password: string, name?: string) {
  return expoSignUpWithEmail(email, password, name);
}

export async function signInWithGoogle() {
  return signInWithSocial("google");
}

export async function signInWithApple() {
  return signInWithSocial("apple");
}

export async function signOut() {
  await expoSignOut();
}
