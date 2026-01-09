/**
 * Consent Management for Expo (Web)
 *
 * Uses the shared @mythos/consent package for GDPR compliance.
 * Manages PostHog and Clarity consent in a unified way.
 *
 * Note: Only works on web platform (posthog-js limitation)
 */

import { Platform } from 'react-native';
import {
  createConsentManager,
  createConsentStorage,
  createPostHogAdapter,
  createClarityAdapter,
  type ConsentManager,
  type ConsentState,
  DEFAULT_CONSENT_STATE,
} from '@mythos/consent';
import { getPostHog } from './analytics';

// Consent policy version - bump to trigger re-consent on policy changes
const CONSENT_POLICY_VERSION = '1.0.0';

let consentManager: ConsentManager | null = null;

/**
 * Check if consent management is available (web only)
 */
export function isConsentAvailable(): boolean {
  return Platform.OS === 'web';
}

/**
 * Get or create the consent manager singleton
 */
export function getConsentManager(): ConsentManager | null {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (!consentManager) {
    consentManager = createConsentManager({
      policyVersion: CONSENT_POLICY_VERSION,
      storage: createConsentStorage(),
      adapters: [
        createPostHogAdapter(() => getPostHog()),
        createClarityAdapter(),
      ],
      onConsentChange: (state) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Consent] State changed:', state.status, state.categories);
        }
      },
    });
  }
  return consentManager;
}

/**
 * Initialize consent manager
 * Call this early in app initialization
 */
export async function initConsent(): Promise<ConsentState> {
  const manager = getConsentManager();
  if (!manager) {
    return DEFAULT_CONSENT_STATE;
  }
  return manager.init();
}

// Re-export convenience functions that delegate to manager
export function getConsentStatus(): ConsentState['status'] {
  const manager = getConsentManager();
  return manager?.getState().status ?? 'pending';
}

export function needsConsent(): boolean {
  const manager = getConsentManager();
  return manager?.needsConsent() ?? false;
}

export function hasConsent(): boolean {
  const manager = getConsentManager();
  return manager?.getState().status === 'granted';
}

export async function grantConsent(): Promise<void> {
  const manager = getConsentManager();
  await manager?.grantAll();
}

export async function denyConsent(): Promise<void> {
  const manager = getConsentManager();
  await manager?.denyAll();
}

export async function revokeConsent(): Promise<void> {
  const manager = getConsentManager();
  await manager?.revokeConsent();
}

// Re-export types for convenience
export type { ConsentState, ConsentManager };
