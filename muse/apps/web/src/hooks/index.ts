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

// Writing analysis
export { useWritingAnalysis } from "./useWritingAnalysis";

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

// Auth sync
export {
  useSupabaseAuthSync,
  signInWithGoogle,
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  updateProfile,
} from "./useSupabaseAuthSync";

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

export {
  useEditorSelection,
  useGetEditorSelection,
} from "./useEditorSelection";

export {
  useEditorChatContext,
  useHasEditorSelection,
} from "./useEditorChatContext";
export type { EditorChatContext } from "./useEditorChatContext";

export { useWorldGraph } from "./useWorldGraph";
export { useGraphLayout, type LayoutAlgorithm, type LayoutDirection } from "./useGraphLayout";
export { useToolRuntime } from "./useToolRuntime";
export type { UseToolRuntimeResult, ToolRuntimeResult } from "./useToolRuntime";

// Progressive linter (Phase 2 → 3 transition)
export { useProgressiveLinter } from "./useProgressiveLinter";
export type { UseProgressiveLinterOptions, UseProgressiveLinterResult } from "./useProgressiveLinter";
