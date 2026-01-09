/**
 * @mythos/consent - Centralized GDPR Consent Management
 *
 * Unified consent management for PostHog, Clarity, and other services.
 * Works across Tauri (macOS) and Expo (web) platforms.
 *
 * @example
 * ```tsx
 * // Setup in app entry
 * import { createConsentManager, createConsentStorage } from '@mythos/consent';
 * import { createPostHogAdapter, createClarityAdapter } from '@mythos/consent';
 * import { ConsentProvider } from '@mythos/consent/react';
 *
 * const manager = createConsentManager({
 *   policyVersion: '1.0.0',
 *   storage: createConsentStorage(),
 *   adapters: [
 *     createPostHogAdapter(() => getPostHog()),
 *     createClarityAdapter(),
 *   ],
 * });
 *
 * function App() {
 *   return (
 *     <ConsentProvider manager={manager}>
 *       <ConsentBanner />
 *       <YourApp />
 *     </ConsentProvider>
 *   );
 * }
 * ```
 */

// Types
export type {
  ConsentStatus,
  ConsentCategories,
  ConsentState,
  ConsentAdapter,
  ConsentStorage,
  ConsentManagerConfig,
} from './types';
export { DEFAULT_CONSENT_STATE } from './types';

// Storage
export {
  LocalStorageConsentStorage,
  MemoryConsentStorage,
  createConsentStorage,
} from './storage';

// Adapters
export {
  PostHogConsentAdapter,
  createPostHogAdapter,
  ClarityConsentAdapter,
  createClarityAdapter,
} from './adapters';

// Manager
export { ConsentManager, createConsentManager } from './manager';
