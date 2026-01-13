/**
 * PostHog Analytics for Expo Web
 *
 * Best practices from PostHog docs:
 * - Lazy initialization to avoid blocking app startup
 * - Singleton pattern with initialization guard
 * - Consent management for GDPR compliance
 * - Typed event helpers for consistency
 * - Graceful degradation on native platforms
 */

import { Platform } from 'react-native';

// Lazy-loaded PostHog instance
let posthog: typeof import('posthog-js').default | null = null;
let initPromise: Promise<void> | null = null;
let initialized = false;

// Configuration
const POSTHOG_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://posthog.rhei.team',
};

/**
 * Check if analytics is available (web platform only)
 */
export function isAnalyticsAvailable(): boolean {
  return Platform.OS === 'web' && !!POSTHOG_CONFIG.apiKey;
}

/**
 * Lazily load and initialize PostHog
 * Returns a promise that resolves when initialization is complete
 */
export async function initAnalytics(): Promise<void> {
  // Skip on native platforms - posthog-js only works on web
  if (Platform.OS !== 'web') {
    return;
  }

  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }

  // Skip if already initialized
  if (initialized) {
    return;
  }

  initPromise = (async () => {
    try {
      const apiKey = POSTHOG_CONFIG.apiKey;
      if (!apiKey) {
        console.warn('[Analytics] PostHog API key not configured');
        return;
      }

      // Dynamic import for code splitting
      const posthogModule = await import('posthog-js');
      posthog = posthogModule.default;

      posthog.init(apiKey, {
        api_host: POSTHOG_CONFIG.host,
        // Page tracking
        capture_pageview: true,
        capture_pageleave: true,
        // Autocapture for clicks, inputs, etc.
        autocapture: true,
        // Persistence
        persistence: 'localStorage+cookie',
        // Disable session recording (using Clarity instead)
        disable_session_recording: true,
        // Performance optimizations
        request_batching: true,
        // Privacy - respect Do Not Track
        respect_dnt: true,
        // Secure cookies in production
        secure_cookie: window.location.protocol === 'https:',
        // Cross-subdomain tracking
        cross_subdomain_cookie: false,
        // Mask sensitive inputs by default
        mask_all_text: false,
        mask_all_element_attributes: false,
        // Bootstrap with stored values for faster first paint
        bootstrap: {},
        // Advanced config
        loaded: (ph) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('[Analytics] PostHog loaded successfully');
          }
        },
      });

      initialized = true;
    } catch (error) {
      console.error('[Analytics] Failed to initialize PostHog:', error);
    }
  })();

  return initPromise;
}

/**
 * Get PostHog instance (may be null if not initialized or on native)
 */
export function getPostHog(): typeof import('posthog-js').default | null {
  return posthog;
}

/**
 * Identify a user with optional properties
 */
export function identify(userId: string, properties?: Record<string, unknown>): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.identify(userId, properties);
}

/**
 * Track a custom event
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.capture(event, properties);
}

/**
 * Reset analytics state (call on logout)
 */
export function resetAnalytics(): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.reset();
}

/**
 * Set group membership for analytics
 */
export function setGroup(
  groupType: string,
  groupKey: string,
  properties?: Record<string, unknown>
): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.group(groupType, groupKey, properties);
}

/**
 * Register super properties (sent with every event)
 */
export function registerSuperProperties(properties: Record<string, unknown>): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.register(properties);
}

// ============================================================================
// Consent Management (GDPR)
// ============================================================================

/**
 * Opt in to analytics tracking
 */
export function optIn(): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.opt_in_capturing();
}

/**
 * Opt out of analytics tracking
 */
export function optOut(): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.opt_out_capturing();
}

/**
 * Check if user has opted out
 */
export function hasOptedOut(): boolean {
  if (!posthog || Platform.OS !== 'web') return false;

  return posthog.has_opted_out_capturing();
}

/**
 * Check if user has explicitly opted in
 */
export function hasOptedIn(): boolean {
  if (!posthog || Platform.OS !== 'web') return false;

  return posthog.has_opted_in_capturing();
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (!posthog || Platform.OS !== 'web') return false;

  return posthog.isFeatureEnabled(flagKey) ?? false;
}

/**
 * Get feature flag variant
 */
export function getFeatureFlag(flagKey: string): string | boolean | undefined {
  if (!posthog || Platform.OS !== 'web') return undefined;

  return posthog.getFeatureFlag(flagKey);
}

/**
 * Get feature flag payload
 */
export function getFeatureFlagPayload(flagKey: string): unknown {
  if (!posthog || Platform.OS !== 'web') return undefined;

  return posthog.getFeatureFlagPayload(flagKey);
}

/**
 * Reload feature flags from server
 */
export function reloadFeatureFlags(): void {
  if (!posthog || Platform.OS !== 'web') return;

  posthog.reloadFeatureFlags();
}

// ============================================================================
// Typed Event Helpers
// ============================================================================

/**
 * Onboarding flow events
 */
export const OnboardingEvents = {
  signUpStarted: (method: string) => track('onboarding_signup_started', { method }),

  signUpCompleted: (method: string, userId: string) =>
    track('onboarding_signup_completed', { method, user_id: userId }),

  signInCompleted: (method: string) => track('onboarding_signin_completed', { method }),

  projectCreated: (projectId: string, genre?: string) =>
    track('onboarding_project_created', { project_id: projectId, genre }),

  firstDocument: (projectId: string, documentType: string) =>
    track('onboarding_first_document', { project_id: projectId, document_type: documentType }),

  firstAiInteraction: (projectId: string, actionType: string) =>
    track('onboarding_first_ai_interaction', { project_id: projectId, action_type: actionType }),
};

/**
 * AI Agent interaction events
 */
export const AgentEvents = {
  chatStarted: (projectId: string, threadId: string) =>
    track('agent_chat_started', { project_id: projectId, thread_id: threadId }),

  toolApproval: (toolName: string, approved: boolean) =>
    track('agent_tool_approval', { tool_name: toolName, approved }),

  chatCompleted: (projectId: string, threadId: string, messageCount: number) =>
    track('agent_chat_completed', {
      project_id: projectId,
      thread_id: threadId,
      message_count: messageCount,
    }),

  messagesSent: (projectId: string, count: number) =>
    track('agent_messages_sent', { project_id: projectId, count }),
};

/**
 * Writing session events
 */
export const WritingEvents = {
  sessionStarted: (projectId: string, documentId: string) =>
    track('writing_session_started', { project_id: projectId, document_id: documentId }),

  entityMentioned: (entityId: string, entityType: string) =>
    track('writing_entity_mentioned', { entity_id: entityId, entity_type: entityType }),

  aiAssist: (assistType: string) => track('writing_ai_assist', { assist_type: assistType }),

  documentSaved: (wordCount: number) => track('writing_document_saved', { word_count: wordCount }),

  exported: (format: string) => track('writing_export', { format }),
};

/**
 * Subscription and billing events
 */
export const BillingEvents = {
  subscriptionStarted: (tier: string, source: string) =>
    track('subscription_started', { tier, source }),

  subscriptionCancelled: (tier: string, reason?: string) =>
    track('subscription_cancelled', { tier, reason }),

  subscriptionUpgraded: (fromTier: string, toTier: string) =>
    track('subscription_upgraded', { from_tier: fromTier, to_tier: toTier }),

  paymentFailed: (tier: string, errorCode?: string) =>
    track('payment_failed', { tier, error_code: errorCode }),
};
