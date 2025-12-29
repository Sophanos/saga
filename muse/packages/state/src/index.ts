/**
 * @mythos/state
 * Platform-agnostic state management for Mythos
 *
 * Provides Zustand stores that work on both web and native platforms.
 */

// Auth store
export { createAuthStore } from "./auth";
export type { AuthState, User } from "./auth";

// Project store
export {
  useProjectStore,
  useCurrentProject,
  useDocuments,
  useEntities,
  useRelationships,
  useProjectLoading,
  useProjectError,
  useEntitiesByType,
  useEntityById,
} from "./project";
export type { ProjectState } from "./project";

// Analysis store
export {
  useAnalysisStore,
  useMetrics,
  useTension,
  useSensoryBalance,
  usePacing,
  useMood,
  useShowDontTellScore,
  useShowDontTellGrade,
  useStyleIssues,
  useInsights,
  useIsAnalyzing,
  useAnalysisError,
  useTotalSensoryCount,
  useIssueCountByType,
} from "./analysis";
export type { AnalysisState } from "./analysis";

// Collaboration store
export {
  useCollaborationStore,
  useProjectMembers,
  useCollaboratorPresence,
  useActivityLog,
  useMyRole,
  useIsReadOnly,
  useIsConnected,
  useActiveCollaborators,
  useCollaboratorsInDocument,
  useMemberById,
  useMembersByRole,
  useRecentActivity,
  generateCollaboratorColor,
} from "./collaboration";
export type {
  CollaborationState,
  ProjectRole,
  ProjectMember,
  CollaboratorPresence,
  ActivityType,
  ActivityLogEntry,
} from "./collaboration";

// Offline store
export {
  useOfflineStore,
  useIsOnline,
  useIsSyncing,
  useSyncError,
  useLastSyncAt,
  usePendingMutationsCount,
  usePendingAiRequestsCount,
  useHasPendingChanges,
  useSyncStatus,
  useOfflineIndicatorData,
  useFailedMutations,
  usePendingMutationsByTable,
  formatTimeSinceSync,
} from "./offline";
export type {
  OfflineState,
  SyncStatus,
  PendingMutation,
} from "./offline";

// Billing store
export {
  createBillingStore,
  useSubscription,
  useUsage,
  useBillingMode,
  useCanUseAI,
  useUsagePercentage,
  useIsSubscriptionActive,
  useBillingLoading,
  useBillingError,
} from "./billing";
export type {
  BillingState,
  BillingStore,
  BillingTier,
  BillingMode,
  SubscriptionStatus,
  Subscription,
  Usage,
  BillingActions,
} from "./billing";

// Progressive store
export {
  useProgressiveStore,
  // Archetype selectors
  useWriterArchetype,
  useArchetypeSelectedAt,
  useHasSelectedArchetype,
  // Onboarding selectors
  useCurrentOnboardingStep,
  useCompletedOnboardingSteps,
  useIsOnboardingComplete,
  useOnboardingProgress,
  // Milestone selectors
  useMilestones,
  useMilestoneById,
  useMilestonesByType,
  useCompletedMilestones,
  usePendingMilestones,
  useMilestoneProgress,
  // UI visibility selectors
  useUIVisibility,
  useIsFeatureVisible,
  useShowOnboardingHints,
  // Captures selectors
  useCaptures,
  useCaptureById,
  useInboxCaptures,
  usePendingCaptures,
  useProcessedCaptures,
  useArchivedCaptures,
  useCapturesByKind,
  useCapturesByProject,
  useCapturesBySource,
  useMobileCaptures,
  useInboxCapturesCount,
  useCapturesLoading,
  useCapturesError,
  useCapturesLastSyncAt,
  useCapturesStats,
  // General selectors
  useProgressiveLoading,
  useProgressiveError,
  // Computed selectors
  useArchetypeRecommendations,
  useIsNewUser,
  useProgressiveSummary,
  // Per-project progressive state selectors
  useActiveProjectId,
  useProjectProgressiveState,
  useActiveProjectProgressiveState,
  useActiveCreationMode,
  useActivePhase,
  useIsModuleUnlocked,
  useUnlockedModules,
  useIsGardenerMode,
  useActiveNudge,
  useHasActiveNudge,
  usePendingDetectedEntities,
  useActiveTotalWritingTime,
  useIsEntityNudgeSnoozed,
  useProgressivePanelVisibility,
} from "./progressive";
export type {
  ProgressiveState,
  WriterArchetype,
  CaptureKind,
  CaptureStatus,
  CaptureRecord,
  MilestoneType,
  Milestone,
  OnboardingStep,
  UIVisibility,
  // New types for progressive structure
  ProgressivePhase,
  UIModuleId,
  NudgeType,
  ProgressiveNudge,
  ProgressiveNudgeBase,
  EntityDiscoveryNudge,
  ConsistencyChoiceNudge,
  FeatureUnlockNudge,
  ProgressiveProjectState,
} from "./progressive";
