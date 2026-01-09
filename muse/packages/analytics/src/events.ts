/**
 * Typed Event Definitions
 *
 * Provides type-safe event tracking with consistent naming and properties.
 * Events are structured for PostHog analytics.
 */

// Event payload types for type safety
export interface EventPayload {
  event: string;
  properties?: Record<string, unknown>;
}

/**
 * Onboarding flow events
 */
export const OnboardingEvents = {
  signUpStarted: (method: string): EventPayload => ({
    event: 'onboarding_signup_started',
    properties: { method },
  }),

  signUpCompleted: (method: string, userId: string): EventPayload => ({
    event: 'onboarding_signup_completed',
    properties: { method, user_id: userId },
  }),

  signInCompleted: (method: string): EventPayload => ({
    event: 'onboarding_signin_completed',
    properties: { method },
  }),

  projectCreated: (projectId: string, genre?: string): EventPayload => ({
    event: 'onboarding_project_created',
    properties: { project_id: projectId, genre },
  }),

  firstDocument: (projectId: string, documentType: string): EventPayload => ({
    event: 'onboarding_first_document',
    properties: { project_id: projectId, document_type: documentType },
  }),

  firstAiInteraction: (projectId: string, actionType: string): EventPayload => ({
    event: 'onboarding_first_ai_interaction',
    properties: { project_id: projectId, action_type: actionType },
  }),
};

/**
 * AI Agent interaction events
 */
export const AgentEvents = {
  chatStarted: (projectId: string, threadId: string, model?: string): EventPayload => ({
    event: 'agent_chat_started',
    properties: { project_id: projectId, thread_id: threadId, model },
  }),

  toolApproval: (toolName: string, approved: boolean): EventPayload => ({
    event: 'agent_tool_approval',
    properties: { tool_name: toolName, approved },
  }),

  chatCompleted: (
    projectId: string,
    threadId: string,
    messageCount: number,
    durationMs?: number
  ): EventPayload => ({
    event: 'agent_chat_completed',
    properties: {
      project_id: projectId,
      thread_id: threadId,
      message_count: messageCount,
      duration_ms: durationMs,
    },
  }),

  messagesSent: (projectId: string, count: number): EventPayload => ({
    event: 'agent_messages_sent',
    properties: { project_id: projectId, count },
  }),

  streamStarted: (threadId: string, model: string): EventPayload => ({
    event: 'agent_stream_started',
    properties: { thread_id: threadId, model },
  }),

  streamCompleted: (threadId: string, durationMs: number, tokenCount?: number): EventPayload => ({
    event: 'agent_stream_completed',
    properties: { thread_id: threadId, duration_ms: durationMs, token_count: tokenCount },
  }),

  streamFailed: (threadId: string, error: string): EventPayload => ({
    event: 'agent_stream_failed',
    properties: { thread_id: threadId, error },
  }),
};

/**
 * Writing session events
 */
export const WritingEvents = {
  sessionStarted: (projectId: string, documentId: string): EventPayload => ({
    event: 'writing_session_started',
    properties: { project_id: projectId, document_id: documentId },
  }),

  sessionEnded: (projectId: string, documentId: string, durationMs: number, wordCount: number): EventPayload => ({
    event: 'writing_session_ended',
    properties: {
      project_id: projectId,
      document_id: documentId,
      duration_ms: durationMs,
      word_count: wordCount,
    },
  }),

  entityMentioned: (entityId: string, entityType: string): EventPayload => ({
    event: 'writing_entity_mentioned',
    properties: { entity_id: entityId, entity_type: entityType },
  }),

  entityCreated: (entityId: string, entityType: string, source: 'manual' | 'detection' | 'ai'): EventPayload => ({
    event: 'writing_entity_created',
    properties: { entity_id: entityId, entity_type: entityType, source },
  }),

  aiAssist: (assistType: string): EventPayload => ({
    event: 'writing_ai_assist',
    properties: { assist_type: assistType },
  }),

  documentSaved: (wordCount: number): EventPayload => ({
    event: 'writing_document_saved',
    properties: { word_count: wordCount },
  }),

  exported: (format: string): EventPayload => ({
    event: 'writing_export',
    properties: { format },
  }),
};

/**
 * Subscription and billing events
 */
export const BillingEvents = {
  subscriptionStarted: (tier: string, source: string): EventPayload => ({
    event: 'subscription_started',
    properties: { tier, source },
  }),

  subscriptionCancelled: (tier: string, reason?: string): EventPayload => ({
    event: 'subscription_cancelled',
    properties: { tier, reason },
  }),

  subscriptionUpgraded: (fromTier: string, toTier: string): EventPayload => ({
    event: 'subscription_upgraded',
    properties: { from_tier: fromTier, to_tier: toTier },
  }),

  paymentFailed: (tier: string, errorCode?: string): EventPayload => ({
    event: 'payment_failed',
    properties: { tier, error_code: errorCode },
  }),

  trialStarted: (tier: string): EventPayload => ({
    event: 'trial_started',
    properties: { tier },
  }),

  trialEnded: (tier: string, converted: boolean): EventPayload => ({
    event: 'trial_ended',
    properties: { tier, converted },
  }),
};

/**
 * Feature usage events
 */
export const FeatureEvents = {
  commandPaletteOpened: (): EventPayload => ({
    event: 'feature_command_palette_opened',
  }),

  commandExecuted: (commandId: string): EventPayload => ({
    event: 'feature_command_executed',
    properties: { command_id: commandId },
  }),

  panelOpened: (panelType: string): EventPayload => ({
    event: 'feature_panel_opened',
    properties: { panel_type: panelType },
  }),

  themeChanged: (theme: 'light' | 'dark'): EventPayload => ({
    event: 'feature_theme_changed',
    properties: { theme },
  }),

  modelChanged: (model: string): EventPayload => ({
    event: 'feature_model_changed',
    properties: { model },
  }),
};
