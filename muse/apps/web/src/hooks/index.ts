// Persistence factory (generic)
export {
  usePersistenceState,
  createPersistenceHook,
} from "./usePersistence";
export type {
  PersistenceResult,
  PersistenceConfig,
  BasePersistenceState,
  UsePersistenceResult,
} from "./usePersistence";

// Entity persistence
export { useEntityPersistence } from "./useEntityPersistence";
export type {
  UseEntityPersistenceResult,
  EntityPersistenceResult,
} from "./useEntityPersistence";

// Mention persistence
export { useMentionPersistence } from "./useMentionPersistence";
export type {
  UseMentionPersistenceResult,
  MentionInput,
  MentionBatchInput,
} from "./useMentionPersistence";

// Relationship persistence
export { useRelationshipPersistence } from "./useRelationshipPersistence";
export type { UseRelationshipPersistenceResult } from "./useRelationshipPersistence";

// Mode management
export { useMode } from "./useMode";

// Entity interactions
export { useEntityClick } from "./useEntityClick";
export { useHudPosition } from "./useHudPosition";
export { useEntityDetection } from "./useEntityDetection";

// API key management
export { useApiKey } from "./useApiKey";

// Auto-save functionality
export { useAutoSave, useAutoSaveStatus } from "./useAutoSave";
export type { UseAutoSaveOptions, UseAutoSaveResult } from "./useAutoSave";

// Content analysis
export { useContentAnalysis } from "./useContentAnalysis";

// Dynamics extraction
export { useDynamicsExtraction } from "./useDynamicsExtraction";

// Project management
export { useProjects } from "./useProjects";
export type { ProjectSummary, UseProjectsResult } from "./useProjects";

export { useProjectLoader } from "./useProjectLoader";

// Linter fixes
export {
  useLinterFixes,
  useLinterData,
  useLinterIssuesByType,
  useLinterIssuesBySeverity,
} from "./useLinterFixes";
export type { UseLinterOptions, UseLinterResult, LinterIssue } from "./useLinterFixes";

// Editor navigation
export {
  useEditorNavigation,
  charOffsetToDocPos,
  findTextPosition,
} from "./useEditorNavigation";

// Analysis history sync
export { useAnalysisHistorySync } from "./useAnalysisHistorySync";
export type {
  UseAnalysisHistorySyncOptions,
  UseAnalysisHistorySyncResult,
} from "./useAnalysisHistorySync";

// Auth - now handled by Better Auth in @mythos/auth
// See apps/web/src/lib/auth.ts for auth client

// Online status
export {
  useOnlineStatus,
  useIsOnline,
  useOfflineIndicator,
} from "./useOnlineStatus";
export type {
  UseOnlineStatusOptions,
  UseOnlineStatusResult,
} from "./useOnlineStatus";

// Collaboration
export { useCollaboration } from "./useCollaboration";
export type {
  CollaborationConnectionStatus,
  UseCollaborationResult,
} from "./useCollaboration";

// Story export
export { useStoryExporter } from "./useStoryExporter";
export type { UseStoryExporterResult } from "./useStoryExporter";

// Story import
export { useStoryImporter } from "./useStoryImporter";
export type { UseStoryImporterResult } from "./useStoryImporter";

// Search
export { useSearch } from "./useSearch";
export type { UseSearchOptions, UseSearchResult } from "./useSearch";

export { useGlobalShortcuts } from "./useGlobalShortcuts";

// Command lock state (progressive disclosure)
export { useIsCommandLocked } from "./useIsCommandLocked";

export {
  useEditorSelection,
  useGetEditorSelection,
} from "./useEditorSelection";

export {
  useEditorChatContext,
  useHasEditorSelection,
} from "./useEditorChatContext";
export type { EditorChatContext } from "./useEditorChatContext";

export { useProjectGraph } from "./useProjectGraph";
export { useProjectTypeRegistry } from "./useProjectTypeRegistry";
export { useGraphLayout, type LayoutAlgorithm, type LayoutDirection } from "./useGraphLayout";
export { useToolRuntime } from "./useToolRuntime";
export type { UseToolRuntimeResult, ToolRuntimeResult } from "./useToolRuntime";

// Progressive linter (Phase 2 → 3 transition)
export { useProgressiveLinter } from "./useProgressiveLinter";
export type { UseProgressiveLinterOptions, UseProgressiveLinterResult } from "./useProgressiveLinter";

// Saga AI Agent
export { useSagaAgent } from "./useSagaAgent";
export type { UseSagaAgentOptions, UseSagaAgentResult } from "./useSagaAgent";
