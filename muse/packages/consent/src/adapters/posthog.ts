/**
 * PostHog Consent Adapter
 *
 * Manages PostHog opt-in/opt-out based on user consent.
 * Works with both posthog-js (web) instances.
 */

import type { ConsentAdapter } from '../types';

type PostHogInstance = {
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
  reset: () => void;
  has_opted_out_capturing: () => boolean;
};

export interface PostHogAdapterConfig {
  /** Function to get PostHog instance (lazy loaded) */
  getPostHog: () => PostHogInstance | null;
}

export class PostHogConsentAdapter implements ConsentAdapter {
  name = 'posthog';
  private config: PostHogAdapterConfig;

  constructor(config: PostHogAdapterConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return this.config.getPostHog() !== null;
  }

  init(): void {
    // PostHog is initialized separately - this adapter just manages consent
  }

  onGranted(): void {
    const posthog = this.config.getPostHog();
    if (posthog) {
      posthog.opt_in_capturing();
    }
  }

  onDenied(): void {
    const posthog = this.config.getPostHog();
    if (posthog) {
      posthog.opt_out_capturing();
    }
  }

  reset(): void {
    const posthog = this.config.getPostHog();
    if (posthog) {
      posthog.reset();
    }
  }
}

/**
 * Create PostHog adapter with lazy getter
 */
export function createPostHogAdapter(
  getPostHog: () => PostHogInstance | null
): PostHogConsentAdapter {
  return new PostHogConsentAdapter({ getPostHog });
}
