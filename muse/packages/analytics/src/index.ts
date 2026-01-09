/**
 * @mythos/analytics
 *
 * Platform-agnostic analytics for Mythos.
 * Provides typed events and integrates with @mythos/consent.
 *
 * @example
 * ```tsx
 * import { OnboardingEvents, AgentEvents } from '@mythos/analytics';
 *
 * // Track events
 * analyticsClient.trackEvent(OnboardingEvents.signUpStarted('google'));
 * analyticsClient.trackEvent(AgentEvents.chatStarted(projectId, threadId));
 * ```
 */

// Events
export {
  OnboardingEvents,
  AgentEvents,
  WritingEvents,
  BillingEvents,
  FeatureEvents,
  type EventPayload,
} from './events';

// Client
export {
  NoopAnalyticsClient,
  createNoopClient,
  type AnalyticsClient,
  type AnalyticsConfig,
} from './client';
