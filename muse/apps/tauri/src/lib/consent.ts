/**
 * Consent Management for Tauri (macOS Desktop)
 *
 * Uses the shared @mythos/consent package for GDPR compliance.
 * Manages PostHog and Clarity consent in a unified way.
 */

import {
  createConsentManager,
  createConsentStorage,
  createPostHogAdapter,
  createClarityAdapter,
  type ConsentManager,
} from '@mythos/consent';
import { getPostHog } from './analytics';

// Consent policy version - bump to trigger re-consent on policy changes
const CONSENT_POLICY_VERSION = '1.0.0';

let consentManager: ConsentManager | null = null;

/**
 * Get or create the consent manager singleton
 */
export function getConsentManager(): ConsentManager {
  if (!consentManager) {
    consentManager = createConsentManager({
      policyVersion: CONSENT_POLICY_VERSION,
      storage: createConsentStorage(),
      adapters: [
        createPostHogAdapter(() => getPostHog()),
        createClarityAdapter(),
      ],
      onConsentChange: (state) => {
        if (import.meta.env.DEV) {
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
export async function initConsent(): Promise<void> {
  const manager = getConsentManager();
  await manager.init();
}

// Re-export convenience functions that delegate to manager
export function getConsentStatus() {
  return getConsentManager().getState().status;
}

export function needsConsent(): boolean {
  return getConsentManager().needsConsent();
}

export function hasConsent(): boolean {
  return getConsentManager().getState().status === 'granted';
}

export async function grantConsent(): Promise<void> {
  await getConsentManager().grantAll();
}

export async function denyConsent(): Promise<void> {
  await getConsentManager().denyAll();
}

export async function revokeConsent(): Promise<void> {
  await getConsentManager().revokeConsent();
}
