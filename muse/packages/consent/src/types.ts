/**
 * Consent Types for GDPR Compliance
 *
 * Categories based on standard GDPR consent framework:
 * - essential: Required for app functionality (Convex, auth)
 * - analytics: Product analytics (PostHog)
 * - sessionReplay: Session recording (Clarity)
 * - marketing: Marketing/advertising (not used currently)
 */

export type ConsentStatus = 'granted' | 'denied' | 'pending';

export interface ConsentCategories {
  /** Essential cookies - always allowed, required for app function */
  essential: true;
  /** Analytics tracking (PostHog) */
  analytics: ConsentStatus;
  /** Session replay (Clarity) */
  sessionReplay: ConsentStatus;
  /** Marketing/advertising - reserved for future */
  marketing: ConsentStatus;
}

export interface ConsentState {
  /** Overall consent status */
  status: ConsentStatus;
  /** Per-category consent */
  categories: ConsentCategories;
  /** When consent was last updated */
  updatedAt: string | null;
  /** App version when consent was given (for re-consent on policy changes) */
  consentVersion: string | null;
}

export interface ConsentAdapter {
  /** Adapter name for debugging */
  name: string;
  /** Initialize the adapter (may be async for lazy loading) */
  init(): Promise<void> | void;
  /** Called when consent is granted */
  onGranted(): void;
  /** Called when consent is denied */
  onDenied(): void;
  /** Called to reset/clear data */
  reset(): void;
  /** Check if adapter is available in current environment */
  isAvailable(): boolean;
}

export interface ConsentStorage {
  get(): Promise<ConsentState | null>;
  set(state: ConsentState): Promise<void>;
  clear(): Promise<void>;
}

export interface ConsentManagerConfig {
  /** Current consent policy version - bump to trigger re-consent */
  policyVersion: string;
  /** Storage adapter */
  storage: ConsentStorage;
  /** Service adapters (PostHog, Clarity, etc.) */
  adapters: ConsentAdapter[];
  /** Callback when consent changes */
  onConsentChange?: (state: ConsentState) => void;
}

/** Default consent state - pending until user action */
export const DEFAULT_CONSENT_STATE: ConsentState = {
  status: 'pending',
  categories: {
    essential: true,
    analytics: 'pending',
    sessionReplay: 'pending',
    marketing: 'pending',
  },
  updatedAt: null,
  consentVersion: null,
};
