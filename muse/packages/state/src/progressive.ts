/**
 * Progressive state store
 * Platform-agnostic progressive disclosure, milestones, and captures inbox state
 */

import { useCallback } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { EntityType } from "@mythos/core";
import { createStorageAdapter } from "@mythos/storage";

// ============================================================================
// Types
// ============================================================================

/**
 * Writer archetype determines UI/UX preferences
 * - architect: Prefers structure, outlines, planning tools
 * - gardener: Prefers organic flow, discovery-based writing
 * - hybrid: Mix of both approaches
 */
export type WriterArchetype = "architect" | "gardener" | "hybrid";

/**
 * Progressive phases for gardener mode
 * - 1: Editor only, tracking word count
 * - 2: Entity discovery triggered, manifest unlockable
 * - 3: First inconsistency detected, console unlockable
 * - 4: Full features available
 */
export type ProgressivePhase = 1 | 2 | 3 | 4;

/**
 * UI modules that can be progressively unlocked
 */
export type UIModuleId =
  | "editor"
  | "manifest"
  | "console"
  | "world_graph"
  | "timeline"
  | "hud"
  | "entity_mentions";

/**
 * Nudge types for progressive disclosure
 */
export type NudgeType = "entity_discovery" | "consistency_choice" | "feature_unlock";

/**
 * Base nudge interface
 */
export interface ProgressiveNudgeBase {
  id: string;
  projectId: string;
  type: NudgeType;
  createdAt: string;
}

/**
 * Entity discovery nudge - shown when entities are detected in text
 */
export interface EntityDiscoveryNudge extends ProgressiveNudgeBase {
  type: "entity_discovery";
  entities: Array<{
    tempId: string;
    name: string;
    type: EntityType;
    count: number;
    confidence: number;
  }>;
}

/**
 * Consistency choice nudge - shown when a contradiction is detected
 */
export interface ConsistencyChoiceNudge extends ProgressiveNudgeBase {
  type: "consistency_choice";
  issueId: string;
  summary: string;
}

/**
 * Feature unlock nudge - shown when a feature becomes available
 */
export interface FeatureUnlockNudge extends ProgressiveNudgeBase {
  type: "feature_unlock";
  module: UIModuleId;
  message: string;
}

/**
 * Union type for all nudges
 */
export type ProgressiveNudge = EntityDiscoveryNudge | ConsistencyChoiceNudge | FeatureUnlockNudge;

/**
 * Per-project progressive state
 */
export interface ProgressiveProjectState {
  creationMode: WriterArchetype;
  phase: ProgressivePhase;

  // Phase 2 - Entity discovery
  entityMentionCounts: Record<string, number>;
  lastEntityNudgeAtWordCount?: number;
  entityNudgeSnoozedUntil?: string;

  // Phase 4 - Module unlocks
  unlockedModules: Partial<Record<UIModuleId, true>>;
  totalWritingTimeSec: number;

  // Preferences
  neverAsk: Partial<Record<NudgeType, true>>;
}

/**
 * Capture kinds from mobile/web
 */
export type CaptureKind = "text" | "voice" | "photo" | "flag" | "chat_plan";

/**
 * Capture processing status
 */
export type CaptureStatus = "inbox" | "processed" | "archived";

/**
 * A capture record from mobile or web
 */
export interface CaptureRecord {
  id: string;
  projectId: string;
  createdBy: string;
  kind: CaptureKind;
  status: CaptureStatus;
  title?: string;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  payload: Record<string, unknown>;
  source: "mobile" | "web";
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

/**
 * Milestone types for tracking progress
 */
export type MilestoneType =
  | "word_count"
  | "chapter_complete"
  | "entity_created"
  | "first_capture"
  | "first_entity"
  | "first_chapter"
  | "world_graph_explored"
  | "ai_chat_used"
  | "custom";

/**
 * A milestone achievement
 */
export interface Milestone {
  id: string;
  type: MilestoneType;
  label: string;
  description?: string;
  targetValue?: number;
  currentValue: number;
  isComplete: boolean;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Onboarding/wizard step status
 */
export type OnboardingStep =
  | "welcome"
  | "archetype_selection"
  | "project_setup"
  | "first_document"
  | "entity_intro"
  | "world_graph_intro"
  | "capture_intro"
  | "complete";

/**
 * UI visibility state for progressive disclosure
 */
export interface UIVisibility {
  // Core features
  showWorldGraph: boolean;
  showEntityPanel: boolean;
  showAnalysisPanel: boolean;
  showCapturesInbox: boolean;
  showAIChat: boolean;

  // Advanced features (unlocked progressively)
  showRelationships: boolean;
  showTimeline: boolean;
  showConflictDetection: boolean;
  showWritingMetrics: boolean;

  // Tooltips and hints
  showOnboardingHints: boolean;
  showFeatureTours: boolean;
}

// ============================================================================
// State Interface
// ============================================================================

export interface ProgressiveState {
  // Writer profile
  archetype: WriterArchetype | null;
  archetypeSelectedAt: string | null;

  // Onboarding
  currentOnboardingStep: OnboardingStep;
  completedOnboardingSteps: OnboardingStep[];
  onboardingCompletedAt: string | null;

  // Milestones
  milestones: Milestone[];

// UI Visibility
  uiVisibility: UIVisibility;

  // Per-project progressive state
  activeProjectId: string | null;
  projects: Record<string, ProgressiveProjectState>;
  activeNudge: ProgressiveNudge | null;
  nudgeQueue: ProgressiveNudge[];

  // Pending detected entities (ephemeral, not persisted)
  pendingDetectedEntities: Array<{
    tempId: string;
    name: string;
    type: EntityType;
    confidence: number;
    occurrences: number;
  }>;

  // Captures inbox
  captures: CaptureRecord[];
  capturesLastSyncAt: string | null;
  capturesLoading: boolean;
  capturesError: string | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions - Archetype
  setArchetype: (archetype: WriterArchetype) => void;
  clearArchetype: () => void;

  // Actions - Onboarding
  setOnboardingStep: (step: OnboardingStep) => void;
  completeOnboardingStep: (step: OnboardingStep) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // Actions - Milestones
  addMilestone: (milestone: Milestone) => void;
  updateMilestoneProgress: (id: string, currentValue: number) => void;
  completeMilestone: (id: string) => void;
  removeMilestone: (id: string) => void;
  clearMilestones: () => void;

  // Actions - UI Visibility
  setUIVisibility: (key: keyof UIVisibility, visible: boolean) => void;
  setMultipleUIVisibility: (updates: Partial<UIVisibility>) => void;
  resetUIVisibility: () => void;

  // Actions - Captures
  setCaptures: (captures: CaptureRecord[]) => void;
  addCapture: (capture: CaptureRecord) => void;
  updateCapture: (id: string, updates: Partial<CaptureRecord>) => void;
  removeCapture: (id: string) => void;
  processCapture: (id: string) => void;
  archiveCapture: (id: string) => void;
  setCapturesLoading: (loading: boolean) => void;
  setCapturesError: (error: string | null) => void;
  setCapturesLastSyncAt: (timestamp: string | null) => void;
  clearCaptures: () => void;

// Actions - General
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Actions - Per-project progressive state
  setActiveProject: (projectId: string | null) => void;
  ensureProject: (projectId: string, defaults?: Partial<ProgressiveProjectState>) => void;
  setCreationMode: (projectId: string, mode: WriterArchetype) => void;
  setPhase: (projectId: string, phase: ProgressivePhase) => void;
  unlockModule: (projectId: string, module: UIModuleId) => void;
  addWritingTime: (projectId: string, deltaSec: number) => void;
  updateEntityMentionCount: (projectId: string, entityName: string, count: number) => void;
  setLastEntityNudgeWordCount: (projectId: string, wordCount: number) => void;
  snoozeEntityNudge: (projectId: string, untilMs: number) => void;

  // Actions - Nudges
  showNudge: (nudge: ProgressiveNudge) => void;
  dismissNudge: (nudgeId: string, opts?: { neverAsk?: boolean; snoozeMs?: number }) => void;
  clearNudge: () => void;

  // Actions - Pending entities
  setPendingDetectedEntities: (entities: Array<{ tempId: string; name: string; type: EntityType; confidence: number; occurrences: number }>) => void;
  clearPendingDetectedEntities: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const defaultUIVisibility: UIVisibility = {
  // Core features - visible by default
  showWorldGraph: true,
  showEntityPanel: true,
  showAnalysisPanel: true,
  showCapturesInbox: true,
  showAIChat: true,

  // Advanced features - hidden until unlocked
  showRelationships: false,
  showTimeline: false,
  showConflictDetection: false,
  showWritingMetrics: false,

  // Hints - shown initially
  showOnboardingHints: true,
  showFeatureTours: true,
};

const initialState = {
  // Writer profile
  archetype: null as WriterArchetype | null,
  archetypeSelectedAt: null as string | null,

  // Onboarding
  currentOnboardingStep: "welcome" as OnboardingStep,
  completedOnboardingSteps: [] as OnboardingStep[],
  onboardingCompletedAt: null as string | null,

  // Milestones
  milestones: [] as Milestone[],

  // UI Visibility
  uiVisibility: defaultUIVisibility,

  // Captures
  captures: [] as CaptureRecord[],
  capturesLastSyncAt: null as string | null,
  capturesLoading: false,
  capturesError: null as string | null,

  // Per-project progressive state
  activeProjectId: null as string | null,
  projects: {} as Record<string, ProgressiveProjectState>,
  activeNudge: null as ProgressiveNudge | null,
  nudgeQueue: [] as ProgressiveNudge[],
  pendingDetectedEntities: [] as Array<{ tempId: string; name: string; type: EntityType; confidence: number; occurrences: number }>,

  // Loading states
  isLoading: false,
  error: null as string | null,
};

/**
 * Default progressive project state for new projects
 */
const defaultProgressiveProjectState: ProgressiveProjectState = {
  creationMode: "architect",
  phase: 4,
  entityMentionCounts: {},
  unlockedModules: { editor: true, manifest: true, console: true, world_graph: true },
  totalWritingTimeSec: 0,
  neverAsk: {},
};

/**
 * Default progressive project state for gardener mode
 */
export const gardenerDefaultState: ProgressiveProjectState = {
  creationMode: "gardener",
  phase: 1,
  entityMentionCounts: {},
  unlockedModules: { editor: true },
  totalWritingTimeSec: 0,
  neverAsk: {},
};

// ============================================================================
// Persistence Configuration
// ============================================================================

/**
 * Version for persistence migrations
 */
const PERSIST_VERSION = 1;

/**
 * Type for the persisted subset of progressive state
 */
type PersistedProgressiveState = {
  archetype: WriterArchetype | null;
  archetypeSelectedAt: string | null;
  completedOnboardingSteps: OnboardingStep[];
  onboardingCompletedAt: string | null;
  currentOnboardingStep: OnboardingStep;
  milestones: Milestone[];
  uiVisibility: UIVisibility;
  activeProjectId: string | null;
  projects: Record<string, {
    creationMode: WriterArchetype;
    phase: ProgressivePhase;
    unlockedModules: Partial<Record<UIModuleId, true>>;
    totalWritingTimeSec: number;
    neverAsk: Partial<Record<NudgeType, true>>;
    lastEntityNudgeAtWordCount?: number;
    entityNudgeSnoozedUntil?: string;
  }>;
};

/**
 * Partialize function - selects which state to persist
 * Excludes ephemeral data like pendingDetectedEntities, captures (synced from DB), loading states
 */
const partialize = (state: ProgressiveState): PersistedProgressiveState => ({
  archetype: state.archetype,
  archetypeSelectedAt: state.archetypeSelectedAt,
  completedOnboardingSteps: state.completedOnboardingSteps,
  onboardingCompletedAt: state.onboardingCompletedAt,
  currentOnboardingStep: state.currentOnboardingStep,
  milestones: state.milestones,
  uiVisibility: state.uiVisibility,
  activeProjectId: state.activeProjectId,
  projects: Object.fromEntries(
    Object.entries(state.projects).map(([id, proj]) => [
      id,
      {
        creationMode: proj.creationMode,
        phase: proj.phase,
        unlockedModules: proj.unlockedModules,
        totalWritingTimeSec: proj.totalWritingTimeSec,
        neverAsk: proj.neverAsk,
        lastEntityNudgeAtWordCount: proj.lastEntityNudgeAtWordCount,
        entityNudgeSnoozedUntil: proj.entityNudgeSnoozedUntil,
      },
    ])
  ),
});

/**
 * Merge function - safely merges persisted state with defaults
 * Ensures nested objects have required default values to prevent runtime errors
 */
const merge = (
  persistedState: unknown,
  currentState: ProgressiveState
): ProgressiveState => {
  const persisted = persistedState as Partial<PersistedProgressiveState> | undefined;
  
  if (!persisted) return currentState;

  // Merge per-project states, ensuring entityMentionCounts exists
  const mergedProjects: Record<string, ProgressiveProjectState> = {};
  
  if (persisted.projects) {
    for (const [projectId, persistedProject] of Object.entries(persisted.projects)) {
      mergedProjects[projectId] = {
        ...defaultProgressiveProjectState,
        ...persistedProject,
        // Always ensure entityMentionCounts exists (not persisted)
        entityMentionCounts: {},
      };
    }
  }

  return {
    ...currentState,
    // Merge persisted user-level state
    archetype: persisted.archetype ?? currentState.archetype,
    archetypeSelectedAt: persisted.archetypeSelectedAt ?? currentState.archetypeSelectedAt,
    completedOnboardingSteps: persisted.completedOnboardingSteps ?? currentState.completedOnboardingSteps,
    onboardingCompletedAt: persisted.onboardingCompletedAt ?? currentState.onboardingCompletedAt,
    currentOnboardingStep: persisted.currentOnboardingStep ?? currentState.currentOnboardingStep,
    milestones: persisted.milestones ?? currentState.milestones,
    uiVisibility: { ...defaultUIVisibility, ...persisted.uiVisibility },
    activeProjectId: persisted.activeProjectId ?? currentState.activeProjectId,
    projects: mergedProjects,
  };
};

/**
 * Migration function for handling version upgrades
 */
const migrate = (
  persistedState: unknown,
  version: number
): PersistedProgressiveState | ProgressiveState => {
  // Handle version migrations as needed
  if (version === 0) {
    // Migration from version 0 to 1 (if needed in future)
    return persistedState as PersistedProgressiveState;
  }
  return persistedState as PersistedProgressiveState;
};

// ============================================================================
// Store
// ============================================================================

export const useProgressiveStore = create<ProgressiveState>()(
  persist(
    immer((set) => ({
    ...initialState,

    // ========================================================================
    // Archetype Actions
    // ========================================================================

    setArchetype: (archetype) =>
      set((state) => {
        state.archetype = archetype;
        state.archetypeSelectedAt = new Date().toISOString();
      }),

    clearArchetype: () =>
      set((state) => {
        state.archetype = null;
        state.archetypeSelectedAt = null;
      }),

    // ========================================================================
    // Onboarding Actions
    // ========================================================================

    setOnboardingStep: (step) =>
      set((state) => {
        state.currentOnboardingStep = step;
      }),

    completeOnboardingStep: (step) =>
      set((state) => {
        if (!state.completedOnboardingSteps.includes(step)) {
          state.completedOnboardingSteps.push(step);
        }
      }),

    completeOnboarding: () =>
      set((state) => {
        state.currentOnboardingStep = "complete";
        state.onboardingCompletedAt = new Date().toISOString();
        if (!state.completedOnboardingSteps.includes("complete")) {
          state.completedOnboardingSteps.push("complete");
        }
      }),

    resetOnboarding: () =>
      set((state) => {
        state.currentOnboardingStep = "welcome";
        state.completedOnboardingSteps = [];
        state.onboardingCompletedAt = null;
      }),

    // ========================================================================
    // Milestone Actions
    // ========================================================================

    addMilestone: (milestone) =>
      set((state) => {
        // Prevent duplicates
        if (!state.milestones.find((m) => m.id === milestone.id)) {
          state.milestones.push(milestone);
        }
      }),

    updateMilestoneProgress: (id, currentValue) =>
      set((state) => {
        const milestone = state.milestones.find((m) => m.id === id);
        if (milestone) {
          milestone.currentValue = currentValue;
          // Auto-complete if target reached
          if (
            milestone.targetValue !== undefined &&
            currentValue >= milestone.targetValue &&
            !milestone.isComplete
          ) {
            milestone.isComplete = true;
            milestone.completedAt = new Date().toISOString();
          }
        }
      }),

    completeMilestone: (id) =>
      set((state) => {
        const milestone = state.milestones.find((m) => m.id === id);
        if (milestone && !milestone.isComplete) {
          milestone.isComplete = true;
          milestone.completedAt = new Date().toISOString();
        }
      }),

    removeMilestone: (id) =>
      set((state) => {
        state.milestones = state.milestones.filter((m) => m.id !== id);
      }),

    clearMilestones: () =>
      set((state) => {
        state.milestones = [];
      }),

    // ========================================================================
    // UI Visibility Actions
    // ========================================================================

    setUIVisibility: (key, visible) =>
      set((state) => {
        state.uiVisibility[key] = visible;
      }),

    setMultipleUIVisibility: (updates) =>
      set((state) => {
        Object.assign(state.uiVisibility, updates);
      }),

    resetUIVisibility: () =>
      set((state) => {
        state.uiVisibility = defaultUIVisibility;
      }),

    // ========================================================================
    // Captures Actions
    // ========================================================================

    setCaptures: (captures) =>
      set((state) => {
        state.captures = captures;
        state.capturesLoading = false;
        state.capturesError = null;
      }),

    addCapture: (capture) =>
      set((state) => {
        // Prevent duplicates
        if (!state.captures.find((c) => c.id === capture.id)) {
          state.captures.unshift(capture); // Add to beginning (newest first)
        }
      }),

    updateCapture: (id, updates) =>
      set((state) => {
        const capture = state.captures.find((c) => c.id === id);
        if (capture) {
          Object.assign(capture, updates, {
            updatedAt: new Date().toISOString(),
          });
        }
      }),

    removeCapture: (id) =>
      set((state) => {
        state.captures = state.captures.filter((c) => c.id !== id);
      }),

    processCapture: (id) =>
      set((state) => {
        const capture = state.captures.find((c) => c.id === id);
        if (capture) {
          capture.status = "processed";
          capture.processedAt = new Date().toISOString();
          capture.updatedAt = new Date().toISOString();
        }
      }),

    archiveCapture: (id) =>
      set((state) => {
        const capture = state.captures.find((c) => c.id === id);
        if (capture) {
          capture.status = "archived";
          capture.updatedAt = new Date().toISOString();
        }
      }),

    setCapturesLoading: (loading) =>
      set((state) => {
        state.capturesLoading = loading;
      }),

    setCapturesError: (error) =>
      set((state) => {
        state.capturesError = error;
        state.capturesLoading = false;
      }),

    setCapturesLastSyncAt: (timestamp) =>
      set((state) => {
        state.capturesLastSyncAt = timestamp;
      }),

    clearCaptures: () =>
      set((state) => {
        state.captures = [];
        state.capturesLastSyncAt = null;
        state.capturesError = null;
      }),

    // ========================================================================
    // General Actions
    // ========================================================================

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isLoading = false;
      }),

    reset: () => set(initialState),

    // ========================================================================
    // Per-Project Progressive State Actions
    // ========================================================================

    setActiveProject: (projectId) =>
      set((state) => {
        state.activeProjectId = projectId;
      }),

    ensureProject: (projectId, defaults) =>
      set((state) => {
        if (!state.projects[projectId]) {
          // Use gardener defaults if creationMode is "gardener"
          const baseState =
            defaults?.creationMode === "gardener"
              ? gardenerDefaultState
              : defaultProgressiveProjectState;
          state.projects[projectId] = {
            ...baseState,
            ...defaults,
          };
        }
      }),

    setCreationMode: (projectId, mode) =>
      set((state) => {
        if (!state.projects[projectId]) {
          state.projects[projectId] = { ...defaultProgressiveProjectState };
        }
        state.projects[projectId].creationMode = mode;
        // Apply mode-specific defaults
        if (mode === "gardener") {
          state.projects[projectId].phase = 1;
          state.projects[projectId].unlockedModules = { editor: true };
        } else {
          state.projects[projectId].phase = 4;
          state.projects[projectId].unlockedModules = {
            editor: true,
            manifest: true,
            console: true,
            world_graph: true,
          };
        }
      }),

    setPhase: (projectId, phase) =>
      set((state) => {
        if (state.projects[projectId]) {
          state.projects[projectId].phase = phase;
        }
      }),

    unlockModule: (projectId, module) =>
      set((state) => {
        if (state.projects[projectId]) {
          state.projects[projectId].unlockedModules[module] = true;
        }
      }),

    addWritingTime: (projectId, deltaSec) =>
      set((state) => {
        if (state.projects[projectId]) {
          state.projects[projectId].totalWritingTimeSec += deltaSec;
        }
      }),

    updateEntityMentionCount: (projectId, entityName, count) =>
      set((state) => {
        if (state.projects[projectId]) {
          state.projects[projectId].entityMentionCounts[entityName] = count;
        }
      }),

    setLastEntityNudgeWordCount: (projectId, wordCount) =>
      set((state) => {
        if (state.projects[projectId]) {
          state.projects[projectId].lastEntityNudgeAtWordCount = wordCount;
        }
      }),

    snoozeEntityNudge: (projectId, untilMs) =>
      set((state) => {
        if (state.projects[projectId]) {
          state.projects[projectId].entityNudgeSnoozedUntil = new Date(
            Date.now() + untilMs
          ).toISOString();
        }
      }),

    // ========================================================================
    // Nudge Actions
    // ========================================================================

    showNudge: (nudge) =>
      set((state) => {
        // Check if this nudge type is in "never ask" for the project
        const projectState = state.projects[nudge.projectId];
        if (projectState?.neverAsk[nudge.type]) {
          return; // Don't show if user said "never ask"
        }

        // If no active nudge, set it directly
        if (!state.activeNudge) {
          state.activeNudge = nudge;
          return;
        }

        // If there's already an active nudge, add to queue (with de-dupe by id)
        const alreadyInQueue = state.nudgeQueue.some((n) => n.id === nudge.id);
        const isActiveNudge = state.activeNudge.id === nudge.id;
        if (!alreadyInQueue && !isActiveNudge) {
          state.nudgeQueue.push(nudge);
        }
      }),

    dismissNudge: (nudgeId, opts) =>
      set((state) => {
        if (state.activeNudge?.id !== nudgeId) return;

        const projectId = state.activeNudge.projectId;
        const nudgeType = state.activeNudge.type;

        // Handle "never ask" preference
        if (opts?.neverAsk && state.projects[projectId]) {
          state.projects[projectId].neverAsk[nudgeType] = true;
        }

        // Handle snooze for entity nudges
        if (
          opts?.snoozeMs &&
          nudgeType === "entity_discovery" &&
          state.projects[projectId]
        ) {
          state.projects[projectId].entityNudgeSnoozedUntil = new Date(
            Date.now() + opts.snoozeMs
          ).toISOString();
        }

        // Pop the next nudge from queue, or clear
        if (state.nudgeQueue.length > 0) {
          state.activeNudge = state.nudgeQueue.shift()!;
        } else {
          state.activeNudge = null;
        }
      }),

    clearNudge: () =>
      set((state) => {
        state.activeNudge = null;
      }),

    // ========================================================================
    // Pending Entities Actions
    // ========================================================================

    setPendingDetectedEntities: (entities) =>
      set((state) => {
        state.pendingDetectedEntities = entities;
      }),

    clearPendingDetectedEntities: () =>
      set((state) => {
        state.pendingDetectedEntities = [];
      }),
  })),
  {
    name: "mythos-progressive-state",
    version: PERSIST_VERSION,
    storage: createJSONStorage(() => createStorageAdapter() as StateStorage),
    partialize,
    merge,
    migrate,
  }
  )
);

// ============================================================================
// Selectors - Archetype
// ============================================================================

export const useWriterArchetype = () =>
  useProgressiveStore((s) => s.archetype);

export const useArchetypeSelectedAt = () =>
  useProgressiveStore((s) => s.archetypeSelectedAt);

export const useHasSelectedArchetype = () =>
  useProgressiveStore((s) => s.archetype !== null);

// ============================================================================
// Selectors - Onboarding
// ============================================================================

export const useCurrentOnboardingStep = () =>
  useProgressiveStore((s) => s.currentOnboardingStep);

export const useCompletedOnboardingSteps = () =>
  useProgressiveStore((s) => s.completedOnboardingSteps);

export const useIsOnboardingComplete = () =>
  useProgressiveStore((s) => s.onboardingCompletedAt !== null);

export const useOnboardingProgress = () =>
  useProgressiveStore((s) => {
    const totalSteps = 8; // Total onboarding steps
    const completed = s.completedOnboardingSteps.length;
    return {
      completed,
      total: totalSteps,
      percentage: Math.round((completed / totalSteps) * 100),
      isComplete: s.onboardingCompletedAt !== null,
    };
  });

// ============================================================================
// Selectors - Milestones
// ============================================================================

export const useMilestones = () => useProgressiveStore((s) => s.milestones);

export const useMilestoneById = (id: string) =>
  useProgressiveStore((s) => s.milestones.find((m) => m.id === id));

export const useMilestonesByType = (type: MilestoneType) =>
  useProgressiveStore((s) => s.milestones.filter((m) => m.type === type));

export const useCompletedMilestones = () =>
  useProgressiveStore((s) => s.milestones.filter((m) => m.isComplete));

export const usePendingMilestones = () =>
  useProgressiveStore((s) => s.milestones.filter((m) => !m.isComplete));

export const useMilestoneProgress = () =>
  useProgressiveStore((s) => {
    const total = s.milestones.length;
    const completed = s.milestones.filter((m) => m.isComplete).length;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

// ============================================================================
// Selectors - UI Visibility
// ============================================================================

export const useUIVisibility = () => useProgressiveStore((s) => s.uiVisibility);

export const useIsFeatureVisible = (feature: keyof UIVisibility) =>
  useProgressiveStore((s) => s.uiVisibility[feature]);

export const useShowOnboardingHints = () =>
  useProgressiveStore((s) => s.uiVisibility.showOnboardingHints);

// ============================================================================
// Selectors - Captures
// ============================================================================

export const useCaptures = () => useProgressiveStore((s) => s.captures);

export const useCaptureById = (id: string) =>
  useProgressiveStore((s) => s.captures.find((c) => c.id === id));

export const useInboxCaptures = () =>
  useProgressiveStore((s) => s.captures.filter((c) => c.status === "inbox"));

export const usePendingCaptures = () =>
  useProgressiveStore((s) => s.captures.filter((c) => c.status === "inbox"));

export const useProcessedCaptures = () =>
  useProgressiveStore((s) => s.captures.filter((c) => c.status === "processed"));

export const useArchivedCaptures = () =>
  useProgressiveStore((s) => s.captures.filter((c) => c.status === "archived"));

export const useCapturesByKind = (kind: CaptureKind) =>
  useProgressiveStore((s) => s.captures.filter((c) => c.kind === kind));

export const useCapturesByProject = (projectId: string) =>
  useProgressiveStore((s) =>
    s.captures.filter((c) => c.projectId === projectId)
  );

export const useCapturesBySource = (source: "mobile" | "web") =>
  useProgressiveStore((s) => s.captures.filter((c) => c.source === source));

export const useMobileCaptures = () =>
  useProgressiveStore((s) => s.captures.filter((c) => c.source === "mobile"));

export const useInboxCapturesCount = () =>
  useProgressiveStore(
    (s) => s.captures.filter((c) => c.status === "inbox").length
  );

export const useCapturesLoading = () =>
  useProgressiveStore((s) => s.capturesLoading);

export const useCapturesError = () =>
  useProgressiveStore((s) => s.capturesError);

export const useCapturesLastSyncAt = () =>
  useProgressiveStore((s) => s.capturesLastSyncAt);

export const useCapturesStats = () =>
  useProgressiveStore((s) => {
    const captures = s.captures;
    return {
      total: captures.length,
      inbox: captures.filter((c) => c.status === "inbox").length,
      processed: captures.filter((c) => c.status === "processed").length,
      archived: captures.filter((c) => c.status === "archived").length,
      fromMobile: captures.filter((c) => c.source === "mobile").length,
      fromWeb: captures.filter((c) => c.source === "web").length,
      byKind: {
        text: captures.filter((c) => c.kind === "text").length,
        voice: captures.filter((c) => c.kind === "voice").length,
        photo: captures.filter((c) => c.kind === "photo").length,
        flag: captures.filter((c) => c.kind === "flag").length,
        chat_plan: captures.filter((c) => c.kind === "chat_plan").length,
      },
    };
  });

// ============================================================================
// Selectors - General
// ============================================================================

export const useProgressiveLoading = () =>
  useProgressiveStore((s) => s.isLoading);

export const useProgressiveError = () => useProgressiveStore((s) => s.error);

// ============================================================================
// Computed Selectors
// ============================================================================

/**
 * Get archetype-specific UI recommendations
 */
export const useArchetypeRecommendations = () =>
  useProgressiveStore((s) => {
    const archetype = s.archetype;
    if (!archetype) return null;

    switch (archetype) {
      case "architect":
        return {
          showOutlineTools: true,
          showStructureView: true,
          suggestPlanning: true,
          defaultView: "outline" as const,
        };
      case "gardener":
        return {
          showOutlineTools: false,
          showStructureView: false,
          suggestPlanning: false,
          defaultView: "freewrite" as const,
        };
      case "hybrid":
        return {
          showOutlineTools: true,
          showStructureView: true,
          suggestPlanning: false,
          defaultView: "mixed" as const,
        };
    }
  });

/**
 * Check if user is new (no archetype, onboarding incomplete)
 */
export const useIsNewUser = () =>
  useProgressiveStore(
    (s) => s.archetype === null && s.onboardingCompletedAt === null
  );

/**
 * Get combined progressive state summary
 */
export const useProgressiveSummary = () =>
  useProgressiveStore((s) => ({
    archetype: s.archetype,
    isOnboardingComplete: s.onboardingCompletedAt !== null,
    milestonesCompleted: s.milestones.filter((m) => m.isComplete).length,
    milestonesTotal: s.milestones.length,
    inboxCount: s.captures.filter((c) => c.status === "inbox").length,
  }));

// ============================================================================
// Selectors - Per-Project Progressive State
// ============================================================================

/**
 * Get the active project ID
 */
export const useActiveProjectId = () =>
  useProgressiveStore((s) => s.activeProjectId);

/**
 * Get the progressive state for a specific project
 */
export const useProjectProgressiveState = (projectId: string | null) =>
  useProgressiveStore((s) =>
    projectId ? s.projects[projectId] ?? null : null
  );

/**
 * Get the progressive state for the active project
 */
export const useActiveProjectProgressiveState = () =>
  useProgressiveStore((s) =>
    s.activeProjectId ? s.projects[s.activeProjectId] ?? null : null
  );

/**
 * Get the creation mode for the active project
 */
export const useActiveCreationMode = () =>
  useProgressiveStore((s) => {
    if (!s.activeProjectId) return null;
    return s.projects[s.activeProjectId]?.creationMode ?? null;
  });

/**
 * Get the current phase for the active project
 */
export const useActivePhase = () =>
  useProgressiveStore((s) => {
    if (!s.activeProjectId) return null;
    return s.projects[s.activeProjectId]?.phase ?? null;
  });

/**
 * Check if a module is unlocked for the active project
 */
export const useIsModuleUnlocked = (module: UIModuleId) =>
  useProgressiveStore((s) => {
    if (!s.activeProjectId) return true; // Default to unlocked if no project
    const projectState = s.projects[s.activeProjectId];
    if (!projectState) return true; // Default to unlocked for legacy projects
    return projectState.unlockedModules[module] === true;
  });

/**
 * Get all unlocked modules for the active project
 */
export const useUnlockedModules = () =>
  useProgressiveStore((s) => {
    if (!s.activeProjectId) return null;
    return s.projects[s.activeProjectId]?.unlockedModules ?? null;
  });

/**
 * Check if the active project is in gardener mode
 */
export const useIsGardenerMode = () =>
  useProgressiveStore((s) => {
    if (!s.activeProjectId) return false;
    return s.projects[s.activeProjectId]?.creationMode === "gardener";
  });

/**
 * Get the active nudge
 */
export const useActiveNudge = () =>
  useProgressiveStore((s) => s.activeNudge);

/**
 * Check if there's an active nudge of a specific type
 */
export const useHasActiveNudge = (type?: NudgeType) =>
  useProgressiveStore((s) => {
    if (!s.activeNudge) return false;
    if (type) return s.activeNudge.type === type;
    return true;
  });

/**
 * Get the length of the nudge queue
 */
export const useNudgeQueueLength = () =>
  useProgressiveStore((s) => s.nudgeQueue.length);

/**
 * Get pending detected entities
 */
export const usePendingDetectedEntities = () =>
  useProgressiveStore((s) => s.pendingDetectedEntities);

/**
 * Get total writing time for the active project
 */
export const useActiveTotalWritingTime = () =>
  useProgressiveStore((s) => {
    if (!s.activeProjectId) return 0;
    return s.projects[s.activeProjectId]?.totalWritingTimeSec ?? 0;
  });

/**
 * Check if entity nudge is snoozed for the active project
 */
export const useIsEntityNudgeSnoozed = () =>
  useProgressiveStore((s) => {
    if (!s.activeProjectId) return false;
    const snoozedUntil = s.projects[s.activeProjectId]?.entityNudgeSnoozedUntil;
    if (!snoozedUntil) return false;
    return new Date(snoozedUntil) > new Date();
  });

// ============================================================================
// Progressive Nudge Actions Hook
// ============================================================================

/**
 * Options for configuring progressive nudge action callbacks
 */
export interface UseProgressiveNudgeActionsOptions {
  /** Called when entity tracking is requested (after state updates) */
  onTrackEntities?: () => void;
  /** Called when consistency resolution is requested */
  onResolveConsistency?: (issueId: string) => void;
  /** Called when a feature unlock is requested */
  onUnlockFeature?: (module: string) => void;
  /** Called to animate out before dismissing (mobile) - if not provided, dismisses immediately */
  onAnimateOut?: (callback: () => void) => void;
}

/**
 * Return type for the useProgressiveNudgeActions hook
 */
export interface UseProgressiveNudgeActionsResult {
  /** Handle tracking entities from an entity discovery nudge */
  handleTrackEntities: () => void;
  /** Handle resolving a consistency issue */
  handleResolveConsistency: () => void;
  /** Handle unlocking a feature */
  handleUnlockFeature: () => void;
  /** Handle dismissing the current nudge */
  handleDismiss: () => void;
  /** Handle "never ask again" for the current nudge type */
  handleNeverAsk: () => void;
  /** Handle snoozing the nudge for 5 minutes */
  handleSnooze: () => void;
}

/**
 * Shared hook for progressive nudge actions
 *
 * Provides handlers for all nudge interactions:
 * - Track entities (unlocks manifest and hud modules)
 * - Resolve consistency issues
 * - Unlock features
 * - Dismiss/snooze/never ask
 *
 * Supports an optional onAnimateOut callback for platforms that need
 * to animate out before dismissing (e.g., React Native).
 *
 * @example
 * // Web usage (no animation)
 * const actions = useProgressiveNudgeActions({
 *   onTrackEntities: () => console.log('Tracked!'),
 * });
 *
 * @example
 * // Mobile usage (with animation)
 * const actions = useProgressiveNudgeActions({
 *   onAnimateOut: (cb) => {
 *     Animated.timing(opacity, { toValue: 0 }).start(cb);
 *   },
 * });
 */
export function useProgressiveNudgeActions(
  options?: UseProgressiveNudgeActionsOptions
): UseProgressiveNudgeActionsResult {
  const nudge = useActiveNudge();
  const dismissNudge = useProgressiveStore((s) => s.dismissNudge);
  const unlockModule = useProgressiveStore((s) => s.unlockModule);

  const finishWithAnimation = useCallback(
    (callback: () => void) => {
      if (options?.onAnimateOut) {
        options.onAnimateOut(callback);
      } else {
        callback();
      }
    },
    [options]
  );

  const handleDismiss = useCallback(() => {
    if (nudge) {
      finishWithAnimation(() => dismissNudge(nudge.id));
    }
  }, [nudge, dismissNudge, finishWithAnimation]);

  const handleNeverAsk = useCallback(() => {
    if (nudge) {
      finishWithAnimation(() => dismissNudge(nudge.id, { neverAsk: true }));
    }
  }, [nudge, dismissNudge, finishWithAnimation]);

  const handleSnooze = useCallback(() => {
    if (nudge) {
      // Snooze for 5 minutes
      finishWithAnimation(() => dismissNudge(nudge.id, { snoozeMs: 5 * 60 * 1000 }));
    }
  }, [nudge, dismissNudge, finishWithAnimation]);

  const handleTrackEntities = useCallback(() => {
    if (nudge && nudge.type === "entity_discovery") {
      // Unlock manifest and hud modules
      unlockModule(nudge.projectId, "manifest");
      unlockModule(nudge.projectId, "hud");
      options?.onTrackEntities?.();
      finishWithAnimation(() => dismissNudge(nudge.id));
    }
  }, [nudge, unlockModule, dismissNudge, options, finishWithAnimation]);

  const handleResolveConsistency = useCallback(() => {
    if (nudge && nudge.type === "consistency_choice") {
      options?.onResolveConsistency?.(nudge.issueId);
      finishWithAnimation(() => dismissNudge(nudge.id));
    }
  }, [nudge, dismissNudge, options, finishWithAnimation]);

  const handleUnlockFeature = useCallback(() => {
    if (nudge && nudge.type === "feature_unlock") {
      unlockModule(nudge.projectId, nudge.module);
      options?.onUnlockFeature?.(nudge.module);
      finishWithAnimation(() => dismissNudge(nudge.id));
    }
  }, [nudge, unlockModule, dismissNudge, options, finishWithAnimation]);

  return {
    handleTrackEntities,
    handleResolveConsistency,
    handleUnlockFeature,
    handleDismiss,
    handleNeverAsk,
    handleSnooze,
  };
}

/**
 * Get UI panel visibility based on progressive state
 * Returns which panels should be shown in the layout
 * Uses useShallow to prevent infinite re-renders when returning objects
 */
export const useProgressivePanelVisibility = () =>
  useProgressiveStore(
    useShallow((s) => {
      // Default to all visible
      const defaultVisibility = {
        showManifest: true,
        showConsole: true,
        showWorldGraph: true,
      };

      if (!s.activeProjectId) return defaultVisibility;

      const projectState = s.projects[s.activeProjectId];
      if (!projectState) return defaultVisibility;

      // For architect mode, everything is visible
      if (projectState.creationMode !== "gardener") return defaultVisibility;

      // For gardener mode, check unlocked modules
      return {
        showManifest: projectState.unlockedModules.manifest === true,
        showConsole: projectState.unlockedModules.console === true,
        showWorldGraph: projectState.unlockedModules.world_graph === true,
      };
    })
  );
