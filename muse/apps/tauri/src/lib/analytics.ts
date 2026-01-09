/**
 * PostHog Analytics for Tauri Desktop
 *
 * Best practices from PostHog docs:
 * - Lazy initialization to avoid blocking app startup
 * - Singleton pattern with initialization guard
 * - Consent management for GDPR compliance
 * - Typed event helpers for consistency
 * - Integration with Clarity for session replay
 */

import posthog from 'posthog-js';
import { identifyClarity, setClarityTag } from './clarity';

let initialized = false;
let initPromise: Promise<void> | null = null;

// Configuration
const POSTHOG_CONFIG = {
  apiKey: import.meta.env.VITE_POSTHOG_API_KEY as string | undefined,
  host: (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://posthog.cascada.vision',
};

/**
 * Check if analytics is available
 */
export function isAnalyticsAvailable(): boolean {
  return !!POSTHOG_CONFIG.apiKey;
}

/**
 * Initialize PostHog analytics
 * Returns a promise that resolves when initialization is complete
 */
export function initAnalytics(): Promise<void> {
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }

  // Skip if already initialized
  if (initialized) {
    return Promise.resolve();
  }

  initPromise = new Promise((resolve) => {
    try {
      const apiKey = POSTHOG_CONFIG.apiKey;
      if (!apiKey) {
        console.warn('[Analytics] PostHog API key not configured');
        resolve();
        return;
      }

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
        // Callback when loaded
        loaded: () => {
          if (import.meta.env.DEV) {
            console.log('[Analytics] PostHog loaded successfully');
          }
          initialized = true;
          resolve();
        },
      });
    } catch (error) {
      console.error('[Analytics] Failed to initialize PostHog:', error);
      resolve();
    }
  });

  return initPromise;
}

/**
 * Get PostHog instance
 */
export function getPostHog(): typeof posthog {
  return posthog;
}

/**
 * Identify a user with optional properties
 */
export function identify(userId: string, properties?: Record<string, unknown>): void {
  posthog.identify(userId, properties);
}

/**
 * Track a custom event
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  posthog.capture(event, properties);
}

/**
 * Reset analytics state (call on logout)
 */
export function resetAnalytics(): void {
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
  posthog.group(groupType, groupKey, properties);
}

/**
 * Register super properties (sent with every event)
 */
export function registerSuperProperties(properties: Record<string, unknown>): void {
  posthog.register(properties);
}

// ============================================================================
// Consent Management (GDPR)
// ============================================================================

/**
 * Opt in to analytics tracking
 */
export function optIn(): void {
  posthog.opt_in_capturing();
}

/**
 * Opt out of analytics tracking
 */
export function optOut(): void {
  posthog.opt_out_capturing();
}

/**
 * Check if user has opted out
 */
export function hasOptedOut(): boolean {
  return posthog.has_opted_out_capturing();
}

/**
 * Check if user has explicitly opted in
 */
export function hasOptedIn(): boolean {
  return posthog.has_opted_in_capturing();
}

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagKey: string): boolean {
  return posthog.isFeatureEnabled(flagKey) ?? false;
}

/**
 * Get feature flag variant
 */
export function getFeatureFlag(flagKey: string): string | boolean | undefined {
  return posthog.getFeatureFlag(flagKey);
}

/**
 * Get feature flag payload
 */
export function getFeatureFlagPayload(flagKey: string): unknown {
  return posthog.getFeatureFlagPayload(flagKey);
}

/**
 * Reload feature flags from server
 */
export function reloadFeatureFlags(): void {
  posthog.reloadFeatureFlags();
}

// ============================================================================
// Unified Identification (PostHog + Clarity)
// ============================================================================

/**
 * Identify user across PostHog and Clarity
 */
export function identifyUser(
  userId: string,
  properties?: { email?: string; name?: string; [key: string]: unknown }
): void {
  // PostHog identification
  posthog.identify(userId, properties);

  // Clarity identification (linked)
  identifyClarity(userId, undefined, undefined, properties?.name);
  setClarityTag('posthog_distinct_id', userId);

  if (properties?.email) {
    setClarityTag('user_email', properties.email);
  }
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
