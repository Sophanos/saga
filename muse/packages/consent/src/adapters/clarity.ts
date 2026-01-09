/**
 * Microsoft Clarity Consent Adapter
 *
 * Manages Clarity consent for session replay.
 * Uses Clarity's consentv2 API for GDPR compliance.
 */

import type { ConsentAdapter } from '../types';

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

export class ClarityConsentAdapter implements ConsentAdapter {
  name = 'clarity';

  isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.clarity === 'function';
  }

  init(): void {
    // Clarity is initialized separately via script tag
  }

  onGranted(): void {
    if (!this.isAvailable()) return;

    window.clarity!('consentv2', {
      ad_Storage: 'granted',
      analytics_Storage: 'granted',
    });
  }

  onDenied(): void {
    if (!this.isAvailable()) return;

    window.clarity!('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'denied',
    });

    // Clear existing cookies
    window.clarity!('consent', false);
  }

  reset(): void {
    if (!this.isAvailable()) return;

    window.clarity!('consent', false);
  }
}

/**
 * Create Clarity adapter
 */
export function createClarityAdapter(): ClarityConsentAdapter {
  return new ClarityConsentAdapter();
}
