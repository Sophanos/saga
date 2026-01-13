/**
 * Auth Configuration
 */

export interface AuthConfig {
  /** Convex Auth issuer origin for sign-in/callbacks */
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
 * Note: Convex Auth runs on Convex HTTP Actions, typically served via convex.rhei.team
 */
export const defaultConfig: AuthConfig = {
  convexSiteUrl: "https://convex.rhei.team",
  convexUrl: "https://convex.rhei.team",
  scheme: "mythos",
  environment: "production",
};

let _config: AuthConfig = defaultConfig;

function assertValidUrl(value: string, label: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(`[auth/config] ${label} is not a valid URL: ${value}`);
  }
}

/**
 * Validate auth configuration
 */
export function validateAuthConfig(config: AuthConfig): void {
  if (!config.convexSiteUrl) {
    throw new Error("[auth/config] convexSiteUrl is required");
  }

  if (!config.convexUrl) {
    throw new Error("[auth/config] convexUrl is required");
  }

  if (!config.scheme) {
    throw new Error("[auth/config] scheme is required");
  }

  assertValidUrl(config.convexSiteUrl, "convexSiteUrl");
  assertValidUrl(config.convexUrl, "convexUrl");
}

/**
 * Initialize auth configuration
 */
export function initAuthConfig(config: Partial<AuthConfig>): AuthConfig {
  _config = { ...defaultConfig, ...config };
  validateAuthConfig(_config);
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
