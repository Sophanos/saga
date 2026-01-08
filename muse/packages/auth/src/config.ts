/**
 * Auth Configuration
 */

export interface AuthConfig {
  /** Convex site URL for Better Auth */
  convexSiteUrl: string;
  /** Convex API URL */
  convexUrl: string;
  /** Deep link scheme for mobile OAuth callbacks */
  scheme: string;
  /** RevenueCat API key */
  revenueCatApiKey?: string;
  /** Environment */
  environment: "development" | "production";
}

/**
 * Default configuration (override per-platform)
 */
export const defaultConfig: AuthConfig = {
  convexSiteUrl: "https://cascada.vision",
  convexUrl: "https://api.cascada.vision",
  scheme: "mythos",
  environment: "production",
};

let _config: AuthConfig = defaultConfig;

/**
 * Initialize auth configuration
 */
export function initAuthConfig(config: Partial<AuthConfig>): AuthConfig {
  _config = { ...defaultConfig, ...config };
  return _config;
}

/**
 * Get current auth configuration
 */
export function getAuthConfig(): AuthConfig {
  return _config;
}

/**
 * Platform detection
 */
export function getPlatform(): "ios" | "android" | "macos" | "windows" | "web" {
  if (typeof window === "undefined") {
    return "web"; // SSR
  }

  // Check for Tauri
  if ("__TAURI__" in window) {
    // Tauri platform detection
    const platform = (window as any).__TAURI__?.os?.platform;
    if (platform === "darwin") return "macos";
    if (platform === "win32") return "windows";
    return "macos"; // Default for Tauri
  }

  // Check for React Native
  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    // React Native platform detection
    const Platform = require("react-native").Platform;
    if (Platform.OS === "ios") return "ios";
    if (Platform.OS === "android") return "android";
    if (Platform.OS === "macos") return "macos";
  }

  return "web";
}

/**
 * Check if running on native platform (not web)
 */
export function isNativePlatform(): boolean {
  const platform = getPlatform();
  return platform !== "web";
}

/**
 * Check if running on Apple platform
 */
export function isApplePlatform(): boolean {
  const platform = getPlatform();
  return platform === "ios" || platform === "macos";
}
