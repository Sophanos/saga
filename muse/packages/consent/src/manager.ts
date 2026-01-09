/**
 * Consent Manager
 *
 * Centralized consent management for GDPR compliance.
 * Coordinates multiple adapters (PostHog, Clarity) and persists state.
 *
 * Usage:
 * ```ts
 * const manager = new ConsentManager({
 *   policyVersion: '1.0.0',
 *   storage: createConsentStorage(),
 *   adapters: [
 *     createPostHogAdapter(() => getPostHog()),
 *     createClarityAdapter(),
 *   ],
 * });
 *
 * await manager.init();
 * manager.grantAll(); // User clicks "Accept All"
 * ```
 */

import type {
  ConsentState,
  ConsentCategories,
  ConsentManagerConfig,
  ConsentAdapter,
} from './types';
import { DEFAULT_CONSENT_STATE } from './types';

export class ConsentManager {
  private config: ConsentManagerConfig;
  private state: ConsentState = DEFAULT_CONSENT_STATE;
  private initialized = false;

  constructor(config: ConsentManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize consent manager - loads persisted state
   */
  async init(): Promise<ConsentState> {
    if (this.initialized) return this.state;

    const stored = await this.config.storage.get();

    if (stored) {
      // Check if policy version changed - require re-consent
      if (stored.consentVersion !== this.config.policyVersion) {
        this.state = {
          ...DEFAULT_CONSENT_STATE,
          // Preserve previous choice as hint but require re-consent
          status: 'pending',
        };
      } else {
        this.state = stored;
        // Apply stored consent to adapters
        await this.applyConsent();
      }
    }

    this.initialized = true;
    return this.state;
  }

  /**
   * Get current consent state
   */
  getState(): ConsentState {
    return this.state;
  }

  /**
   * Check if consent is pending (needs user action)
   */
  needsConsent(): boolean {
    return this.state.status === 'pending';
  }

  /**
   * Check if analytics consent is granted
   */
  hasAnalyticsConsent(): boolean {
    return this.state.categories.analytics === 'granted';
  }

  /**
   * Check if session replay consent is granted
   */
  hasSessionReplayConsent(): boolean {
    return this.state.categories.sessionReplay === 'granted';
  }

  /**
   * Grant all consent (Accept All button)
   */
  async grantAll(): Promise<void> {
    await this.updateConsent({
      essential: true,
      analytics: 'granted',
      sessionReplay: 'granted',
      marketing: 'granted',
    });
  }

  /**
   * Deny all non-essential consent (Reject All button)
   */
  async denyAll(): Promise<void> {
    await this.updateConsent({
      essential: true,
      analytics: 'denied',
      sessionReplay: 'denied',
      marketing: 'denied',
    });
  }

  /**
   * Grant only essential (required) cookies
   */
  async grantEssentialOnly(): Promise<void> {
    await this.denyAll();
  }

  /**
   * Update specific consent categories
   */
  async updateConsent(categories: Partial<ConsentCategories>): Promise<void> {
    const newCategories: ConsentCategories = {
      ...this.state.categories,
      ...categories,
      essential: true, // Always true
    };

    // Determine overall status
    const nonEssentialStatuses = [
      newCategories.analytics,
      newCategories.sessionReplay,
      newCategories.marketing,
    ];

    let status: ConsentState['status'];
    if (nonEssentialStatuses.every((s) => s === 'granted')) {
      status = 'granted';
    } else if (nonEssentialStatuses.every((s) => s === 'denied')) {
      status = 'denied';
    } else if (nonEssentialStatuses.some((s) => s === 'pending')) {
      status = 'pending';
    } else {
      // Mixed granted/denied - treat as granted (partial consent)
      status = 'granted';
    }

    this.state = {
      status,
      categories: newCategories,
      updatedAt: new Date().toISOString(),
      consentVersion: this.config.policyVersion,
    };

    await this.persist();
    await this.applyConsent();
    this.config.onConsentChange?.(this.state);
  }

  /**
   * Revoke all consent and clear data
   */
  async revokeConsent(): Promise<void> {
    // Deny all categories
    await this.denyAll();

    // Reset all adapters
    for (const adapter of this.config.adapters) {
      try {
        if (adapter.isAvailable()) {
          adapter.reset();
        }
      } catch (error) {
        console.error(`[Consent] Failed to reset ${adapter.name}:`, error);
      }
    }

    // Clear stored consent
    await this.config.storage.clear();

    // Reset to default state
    this.state = DEFAULT_CONSENT_STATE;
    this.config.onConsentChange?.(this.state);
  }

  /**
   * Apply current consent state to all adapters
   */
  private async applyConsent(): Promise<void> {
    for (const adapter of this.config.adapters) {
      try {
        if (!adapter.isAvailable()) continue;

        const category = this.getCategoryForAdapter(adapter);
        const status = this.state.categories[category];

        if (status === 'granted') {
          adapter.onGranted();
        } else if (status === 'denied') {
          adapter.onDenied();
        }
        // 'pending' - do nothing, wait for user action
      } catch (error) {
        console.error(`[Consent] Failed to apply consent to ${adapter.name}:`, error);
      }
    }
  }

  /**
   * Get the consent category for an adapter
   */
  private getCategoryForAdapter(adapter: ConsentAdapter): keyof ConsentCategories {
    switch (adapter.name) {
      case 'posthog':
        return 'analytics';
      case 'clarity':
        return 'sessionReplay';
      default:
        return 'analytics';
    }
  }

  /**
   * Persist consent state to storage
   */
  private async persist(): Promise<void> {
    await this.config.storage.set(this.state);
  }
}

/**
 * Create a consent manager with default configuration
 */
export function createConsentManager(
  config: ConsentManagerConfig
): ConsentManager {
  return new ConsentManager(config);
}
