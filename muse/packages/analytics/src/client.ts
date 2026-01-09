/**
 * Analytics Client
 *
 * Platform-agnostic analytics client that wraps PostHog.
 * Apps should create a platform-specific implementation.
 */

import type { EventPayload } from './events';

export interface AnalyticsConfig {
  apiKey: string;
  host?: string;
  autocapture?: boolean;
  disableSessionRecording?: boolean;
}

export interface AnalyticsClient {
  /** Initialize the analytics client */
  init(): Promise<void>;
  /** Check if client is initialized */
  isInitialized(): boolean;
  /** Identify a user */
  identify(userId: string, properties?: Record<string, unknown>): void;
  /** Track an event */
  track(event: string, properties?: Record<string, unknown>): void;
  /** Track a typed event */
  trackEvent(payload: EventPayload): void;
  /** Reset analytics state (on logout) */
  reset(): void;
  /** Set group membership */
  setGroup(groupType: string, groupKey: string, properties?: Record<string, unknown>): void;
  /** Register super properties */
  registerSuperProperties(properties: Record<string, unknown>): void;
  /** Opt in to tracking */
  optIn(): void;
  /** Opt out of tracking */
  optOut(): void;
  /** Check if opted out */
  hasOptedOut(): boolean;
  /** Check if opted in */
  hasOptedIn(): boolean;
  /** Check if feature flag is enabled */
  isFeatureEnabled(flagKey: string): boolean;
  /** Get feature flag value */
  getFeatureFlag(flagKey: string): string | boolean | undefined;
  /** Get feature flag payload */
  getFeatureFlagPayload(flagKey: string): unknown;
  /** Reload feature flags */
  reloadFeatureFlags(): void;
}

/**
 * No-op analytics client for when analytics is disabled or unavailable
 */
export class NoopAnalyticsClient implements AnalyticsClient {
  async init(): Promise<void> {}
  isInitialized(): boolean { return false; }
  identify(): void {}
  track(): void {}
  trackEvent(): void {}
  reset(): void {}
  setGroup(): void {}
  registerSuperProperties(): void {}
  optIn(): void {}
  optOut(): void {}
  hasOptedOut(): boolean { return true; }
  hasOptedIn(): boolean { return false; }
  isFeatureEnabled(): boolean { return false; }
  getFeatureFlag(): undefined { return undefined; }
  getFeatureFlagPayload(): undefined { return undefined; }
  reloadFeatureFlags(): void {}
}

/**
 * Create a no-op analytics client
 */
export function createNoopClient(): AnalyticsClient {
  return new NoopAnalyticsClient();
}
