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
 * Note: BetterAuth runs on Convex HTTP routes, so convexSiteUrl = convexUrl
 */
export const defaultConfig: AuthConfig = {
  convexSiteUrl: "https://convex.cascada.vision",
  convexUrl: "https://convex.cascada.vision",
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
 * Platform detection - set by native entry points
 */
let _detectedPlatform: "ios" | "android" | "macos" | "windows" | "web" = "web";

/**
 * Set the platform (call from native entry point)
 */
export function setPlatform(platform: "ios" | "android" | "macos" | "windows" | "web"): void {
  _detectedPlatform = platform;
}

/**
 * Get current platform
 */
export function getPlatform(): "ios" | "android" | "macos" | "windows" | "web" {
  if (typeof window === "undefined") {
    return "web"; // SSR
  }

  // Check for Tauri
  if ("__TAURI__" in window) {
    const platform = (window as any).__TAURI__?.os?.platform;
    if (platform === "darwin") return "macos";
    if (platform === "win32") return "windows";
    return "macos"; // Default for Tauri
  }

  return _detectedPlatform;
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
