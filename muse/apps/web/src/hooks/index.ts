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
  MentionPersistenceResult,
  MentionInput,
  MentionBatchInput,
} from "./useMentionPersistence";

// Relationship persistence
export { useRelationshipPersistence } from "./useRelationshipPersistence";
export type {
  UseRelationshipPersistenceResult,
  RelationshipPersistenceResult,
} from "./useRelationshipPersistence";

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
