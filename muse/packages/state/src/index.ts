/**
 * @mythos/state
 * Platform-agnostic state management for Mythos
 *
 * Provides Zustand stores that work on both web and native platforms.
 */

// ============================================================
// AI STORE
// ============================================================
export {
  useAIStore,
  useCurrentThread,
  useHasMessages,
  AI_MODELS,
  CONTEXT_SCOPES,
  QUICK_ACTIONS,
} from "./ai";
export type {
  AIModel,
  ContextScope,
  QuickAction,
  ChatMessage,
  ChatThread,
  ContextChip,
  MessageToolCall,
  PendingQuestion,
  ToolCallStatus,
  QuestionOption,
} from "./ai";

// ============================================================
// WORKSPACE STORE
// ============================================================
export {
  useWorkspaceStore,
  usePendingQuestions,
  useActivePanel,
  useFocusedEntity,
  useGraphConfig,
  useToolExecutions,
} from "./workspace";
export type {
  PanelType,
  WorldBuilderTab,
  ToolCallType,
  WorkspaceToolExecution,
  WorkspacePendingQuestion,
  GraphConfig,
  ToolCallPayload,
  AskQuestionPayload,
  OpenPanelPayload,
  FocusEntityPayload,
  ShowGraphPayload,
  CreateEntityPayload,
  CreateRelationshipPayload,
} from "./workspace";

// ============================================================
// COMMAND PALETTE STORE
// ============================================================
export {
  useCommandPaletteStore,
  useCommandPaletteOpen,
  useCommandPaletteQuery,
  useCommandPaletteFilter,
} from "./commandPalette";
export type {
  CommandCategory,
  CommandFilter,
} from "./commandPalette";

// ============================================================
// LAYOUT STORE
// ============================================================
export {
  useLayoutStore,
  useSidebarCollapsed,
  useSidebarWidth,
  useViewMode,
  useCurrentProjectId,
  useAIPanelMode,
  useAIPanelWidth,
  LAYOUT_SIZING,
} from "./layout";
export type {
  ViewMode,
  AIPanelMode,
} from "./layout";

// ============================================================
// AUTH STORE
// ============================================================
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
  // Shared hooks
  useProgressiveNudgeActions,
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
  UseProgressiveNudgeActionsOptions,
  UseProgressiveNudgeActionsResult,
} from "./progressive";

// ============================================================
// RESET UTILITIES
// ============================================================
export {
  resetAllClientState,
  clearAllPersistedStorage,
  hardReset,
} from "./resetAll";
