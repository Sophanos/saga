/**
 * Artifact Store - State management for AI-generated artifacts
 * Handles artifact panel, iteration chat, and artifact lifecycle
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createStorageAdapter } from '@mythos/storage';
import { parseArtifactEnvelope, type ArtifactEnvelopeByType } from '@mythos/core';
import {
  applyArtifactPatch,
  compileArtifactOp,
  type ArtifactOp,
  type ArtifactOpLogEntry,
} from './artifactEngine';

// Artifact types
export type ArtifactType =
  | 'prose'
  | 'dialogue'
  | 'entity'
  | 'entityCard'
  | 'outline'
  | 'lore'
  | 'diagram'
  | 'timeline'
  | 'table'
  | 'chart'
  | 'map'
  | 'code'
  | 'web'
  | 'github'
  | 'document';

// Artifact type labels
export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  prose: 'Prose',
  dialogue: 'Dialogue',
  entity: 'Entity',
  entityCard: 'Entity Card',
  outline: 'Outline',
  lore: 'Lore',
  diagram: 'Diagram',
  timeline: 'Timeline',
  table: 'Table',
  chart: 'Chart',
  map: 'Map',
  code: 'Code',
  web: 'Web Content',
  github: 'GitHub',
  document: 'Document',
};

// Artifact type icon names (Feather/Lucide compatible)
export const ARTIFACT_TYPE_ICONS: Record<ArtifactType, string> = {
  prose: 'file-text',
  dialogue: 'message-circle',
  entity: 'user',
  entityCard: 'user-square',
  outline: 'list',
  lore: 'book-open',
  diagram: 'git-branch',
  timeline: 'clock',
  table: 'grid',
  chart: 'bar-chart-2',
  map: 'map',
  code: 'code',
  web: 'globe',
  github: 'github',
  document: 'file',
};

export type ArtifactStatus = 'draft' | 'manually_modified' | 'applied' | 'saved';

export type ArtifactStalenessStatus = 'fresh' | 'stale' | 'missing' | 'external';

/**
 * Sync metadata for tracking artifact persistence state
 */
export type ArtifactSyncStatus = 'synced' | 'dirty' | 'syncing' | 'error';

export interface ArtifactSyncMetadata {
  status: ArtifactSyncStatus;
  lastSyncedAt?: number;
  lastError?: string;
  pendingOps?: ArtifactOp[];
  pendingContent?: {
    content: string;
    format: 'markdown' | 'mermaid' | 'json' | 'plain';
  };
}

export interface ArtifactSource {
  type: string;
  id: string;
  title?: string;
  manual: boolean;
  addedAt: number;
  sourceUpdatedAt?: number;
  status?: ArtifactStalenessStatus;
}

export interface ArtifactExecutionContext {
  widgetId: string;
  widgetVersion: string;
  model: string;
  inputs: unknown;
  startedAt: number;
  completedAt: number;
}

// Iteration message in mini-chat
export interface IterationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  context?: {
    artifactId?: string;
    artifactContent?: string;
    referenceId?: string;
    referenceType?: 'document' | 'entity';
    documentId?: string;
    documentTitle?: string;
    documentContent?: unknown;
  };
}

// Artifact version for history
export interface ArtifactVersion {
  id: string;
  content: string;
  timestamp: number;
  trigger: 'creation' | 'iteration' | 'manual';
}

// Main artifact interface
export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  format: 'markdown' | 'mermaid' | 'json' | 'plain';

  // Server status (persisted)
  status: ArtifactStatus;

  // Iteration
  iterationHistory: IterationMessage[];
  versions: ArtifactVersion[];
  currentVersionId: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
  projectId?: string;
  createdBy?: string;

  // Source info
  source?: {
    tool?: string;
    model?: string;
    threadId?: string;
  };

  // Receipts / provenance (server-backed)
  sources?: ArtifactSource[];
  executionContext?: ArtifactExecutionContext;
  staleness?: ArtifactStalenessStatus;

  // RAS validation + ops
  validationErrors?: string[];
  opLog: ArtifactOpLogEntry[];

  // Reference to opened content
  referenceId?: string; // document or entity ID
  referenceType?: 'document' | 'entity';

  // Sync state
  sync?: ArtifactSyncMetadata;
}

// Panel mode
export type ArtifactPanelMode = 'hidden' | 'side' | 'floating';

export type ArtifactSplitMode = 'side-by-side' | 'before-after' | 'inline';

interface ArtifactStore {
  // Panel state
  panelMode: ArtifactPanelMode;
  panelWidth: number;
  setPanelMode: (mode: ArtifactPanelMode) => void;
  setPanelWidth: (width: number) => void;
  togglePanel: () => void;

  // Focus state for deep links
  focusedElements: Record<string, string | null>;

  // Compare / split view
  splitView: {
    active: boolean;
    leftId: string | null;
    rightId: string | null;
    mode: ArtifactSplitMode;
  };
  setSplitView: (next: Partial<ArtifactStore['splitView']>) => void;
  enterSplitView: (leftId: string, rightId: string, mode?: ArtifactSplitMode) => void;
  exitSplitView: () => void;

  // Iteration pill state
  iterationInput: string;
  iterationPillExpanded: boolean;
  iterationHistoryVisible: boolean;
  setIterationInput: (value: string) => void;
  setIterationPillExpanded: (expanded: boolean) => void;
  setIterationHistoryVisible: (visible: boolean) => void;

  // Current artifact
  artifacts: Artifact[];
  activeArtifactId: string | null;
  recentArtifactIds: string[];
  setActiveArtifact: (id: string | null) => void;

  // CRUD
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt' | 'versions' | 'currentVersionId' | 'iterationHistory' | 'status' | 'opLog' | 'validationErrors'>) => string;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  upsertArtifact: (artifact: Artifact) => void;
  upsertArtifacts: (artifacts: Artifact[]) => void;
  removeArtifact: (id: string) => void;
  clearArtifacts: () => void;

  // Iteration
  addIterationMessage: (artifactId: string, message: Omit<IterationMessage, 'id' | 'timestamp'>) => void;
  clearIterationHistory: (artifactId: string) => void;

  // Versioning
  addVersion: (artifactId: string, content: string, trigger: ArtifactVersion['trigger']) => void;
  restoreVersion: (artifactId: string, versionId: string) => void;

  // RAS ops
  applyArtifactOp: (artifactId: string, op: ArtifactOp) => void;

  // Sync management
  markArtifactDirty: (artifactId: string) => void;
  enqueueArtifactOp: (artifactId: string, op: ArtifactOp) => void;
  clearPendingOps: (artifactId: string) => void;
  setSyncStatus: (artifactId: string, status: ArtifactSyncStatus, error?: string) => void;
  mergeServerArtifacts: (serverArtifacts: Artifact[]) => void;
  setFocusId: (artifactId: string, focusId: string | null) => void;

  // Tab operations
  duplicateArtifact: (id: string) => string;
  mergeTabs: (sourceId: string, targetId: string) => void;
  branchFromArtifact: (id: string, newTitle?: string) => string;
  reorderArtifacts: (fromIndex: number, toIndex: number) => void;

  // Quick actions
  showArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt' | 'versions' | 'currentVersionId' | 'iterationHistory' | 'status' | 'opLog' | 'validationErrors'>) => void;
  openDocument: (documentId: string, title: string, content: string) => void;
  openEntity: (entityId: string, name: string, data: Record<string, unknown>) => void;
  closePanel: () => void;

  // Reset
  reset: () => void;
}

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 600;
const PANEL_DEFAULT_WIDTH = 400;

function generateId(): string {
  return `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function validateArtifactEnvelope(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return [];
    }
    if (!('schemaVersion' in parsed) || !('artifactId' in parsed)) {
      return [];
    }
    parseArtifactEnvelope(parsed);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : 'Invalid artifact envelope'];
  }
}

const initialState = {
  panelMode: 'hidden' as ArtifactPanelMode,
  panelWidth: PANEL_DEFAULT_WIDTH,
  splitView: {
    active: false,
    leftId: null,
    rightId: null,
    mode: 'side-by-side' as ArtifactSplitMode,
  },
  artifacts: [] as Artifact[],
  activeArtifactId: null as string | null,
  recentArtifactIds: [] as string[],
  iterationInput: '',
  iterationPillExpanded: false,
  iterationHistoryVisible: true,
  // Focus state for deep links
  focusedElements: {} as Record<string, string | null>,
};

export const useArtifactStore = create<ArtifactStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Panel
      setPanelMode: (mode) => set({ panelMode: mode }),
      setPanelWidth: (width) =>
        set({ panelWidth: Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, width)) }),
      togglePanel: () => {
        const current = get().panelMode;
        set({ panelMode: current === 'hidden' ? 'side' : 'hidden' });
      },

      // Compare / split view
      setSplitView: (next) =>
        set((state) => ({
          splitView: { ...state.splitView, ...next },
        })),
      enterSplitView: (leftId, rightId, mode) =>
        set({
          splitView: {
            active: true,
            leftId,
            rightId,
            mode: mode ?? 'side-by-side',
          },
        }),
      exitSplitView: () =>
        set({
          splitView: {
            active: false,
            leftId: null,
            rightId: null,
            mode: get().splitView.mode,
          },
        }),

      // Iteration pill
      setIterationInput: (value) => set({ iterationInput: value }),
      setIterationPillExpanded: (expanded) => set({ iterationPillExpanded: expanded }),
      setIterationHistoryVisible: (visible) => set({ iterationHistoryVisible: visible }),

      // Active
      setActiveArtifact: (id) => {
        if (!id) {
          set({ activeArtifactId: null });
          return;
        }
        const { recentArtifactIds } = get();
        const MAX_RECENT = 10;
        const updated = [id, ...recentArtifactIds.filter((rid) => rid !== id)].slice(0, MAX_RECENT);
        set({ activeArtifactId: id, recentArtifactIds: updated });
      },

      // CRUD
      addArtifact: (artifact) => {
        const id = generateId();
        const now = Date.now();
        const versionId = `v-${now}`;
        const validationErrors =
          artifact.format === 'json' ? validateArtifactEnvelope(artifact.content) : [];
        const newArtifact: Artifact = {
          ...artifact,
          id,
          status: 'draft',
          iterationHistory: [],
          versions: [{ id: versionId, content: artifact.content, timestamp: now, trigger: 'creation' }],
          currentVersionId: versionId,
          createdAt: now,
          updatedAt: now,
          validationErrors,
          opLog: [],
        };
        set((s) => ({
          artifacts: [...s.artifacts, newArtifact],
          activeArtifactId: id,
          panelMode: s.panelMode === 'hidden' ? 'side' : s.panelMode,
        }));
        return id;
      },

      updateArtifact: (id, updates) => {
        set((s) => ({
          artifacts: s.artifacts.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...updates,
                  validationErrors:
                    typeof updates.content === 'string' && a.format === 'json'
                      ? validateArtifactEnvelope(updates.content)
                      : a.validationErrors,
                  updatedAt: Date.now(),
                }
              : a
          ),
        }));
      },

      upsertArtifact: (artifact) => {
        set((s) => {
          const existingIndex = s.artifacts.findIndex((a) => a.id === artifact.id);
          if (existingIndex === -1) {
            return {
              artifacts: [...s.artifacts, artifact],
              activeArtifactId: s.activeArtifactId ?? artifact.id,
            };
          }

          const nextArtifacts = [...s.artifacts];
          nextArtifacts[existingIndex] = { ...nextArtifacts[existingIndex], ...artifact };
          return { artifacts: nextArtifacts };
        });
      },

      upsertArtifacts: (artifacts) => {
        set((s) => {
          const byId = new Map(s.artifacts.map((artifact) => [artifact.id, artifact]));
          for (const artifact of artifacts) {
            const existing = byId.get(artifact.id);
            byId.set(artifact.id, existing ? { ...existing, ...artifact } : artifact);
          }

          const nextArtifacts = Array.from(byId.values());
          const activeArtifactId =
            s.activeArtifactId && byId.has(s.activeArtifactId)
              ? s.activeArtifactId
              : nextArtifacts[0]?.id ?? null;

          return { artifacts: nextArtifacts, activeArtifactId };
        });
      },

      removeArtifact: (id) => {
        set((s) => {
          const newArtifacts = s.artifacts.filter((a) => a.id !== id);
          const newActiveId = s.activeArtifactId === id
            ? newArtifacts[0]?.id ?? null
            : s.activeArtifactId;
          return {
            artifacts: newArtifacts,
            activeArtifactId: newActiveId,
            panelMode: newArtifacts.length === 0 ? 'hidden' : s.panelMode,
          };
        });
      },

      clearArtifacts: () => set({ artifacts: [], activeArtifactId: null }),

      // Iteration
      addIterationMessage: (artifactId, message) => {
        const id = `msg-${Date.now()}`;
        set((s) => ({
          artifacts: s.artifacts.map((a) =>
            a.id === artifactId
              ? {
                  ...a,
                  iterationHistory: [
                    ...a.iterationHistory,
                    {
                      ...message,
                      id,
                      timestamp: Date.now(),
                      context: {
                        ...(message.context ?? {}),
                        artifactId: a.id,
                        artifactContent: a.content,
                        referenceId: a.referenceId ?? message.context?.referenceId,
                        referenceType: a.referenceType ?? message.context?.referenceType,
                      },
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : a
          ),
        }));
      },

      clearIterationHistory: (artifactId) => {
        set((s) => ({
          artifacts: s.artifacts.map((a) =>
            a.id === artifactId ? { ...a, iterationHistory: [] } : a
          ),
        }));
      },

      // Versioning
      addVersion: (artifactId, content, trigger) => {
        const versionId = `v-${Date.now()}`;
        set((s) => ({
          artifacts: s.artifacts.map((a) =>
            a.id === artifactId
              ? {
                  ...a,
                  content,
                  versions: [...a.versions, { id: versionId, content, timestamp: Date.now(), trigger }],
                  currentVersionId: versionId,
                  validationErrors: a.format === 'json' ? validateArtifactEnvelope(content) : a.validationErrors,
                  updatedAt: Date.now(),
                }
              : a
          ),
        }));
      },

      restoreVersion: (artifactId, versionId) => {
        set((s) => ({
          artifacts: s.artifacts.map((a) => {
            if (a.id !== artifactId) return a;
            const version = a.versions.find((v) => v.id === versionId);
            if (!version) return a;
            return {
              ...a,
              content: version.content,
              currentVersionId: versionId,
              validationErrors: a.format === 'json' ? validateArtifactEnvelope(version.content) : a.validationErrors,
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      applyArtifactOp: (artifactId, op) => {
        set((s) => ({
          artifacts: s.artifacts.map((artifact) => {
            if (artifact.id !== artifactId) return artifact;
            if (artifact.format !== 'json') return artifact;

            let envelope: ArtifactEnvelopeByType;
            try {
              envelope = parseArtifactEnvelope(JSON.parse(artifact.content));
            } catch (error) {
              return {
                ...artifact,
                validationErrors: [
                  error instanceof Error ? error.message : 'Invalid artifact envelope',
                ],
              };
            }

            const patch = compileArtifactOp(envelope, op);
            const result = applyArtifactPatch(envelope, patch);
            const nextContent = JSON.stringify(result.next, null, 2);
            const nextLog = [...artifact.opLog, result.logEntry];

            return {
              ...artifact,
              content: nextContent,
              opLog: nextLog,
              validationErrors: [],
              updatedAt: Date.now(),
              // Mark as dirty when ops are applied locally
              sync: {
                ...artifact.sync,
                status: 'dirty' as ArtifactSyncStatus,
                pendingOps: [...(artifact.sync?.pendingOps ?? []), op],
              },
            };
          }),
        }));
      },

      // Sync management
      markArtifactDirty: (artifactId) => {
        set((s) => ({
          artifacts: s.artifacts.map((artifact) =>
            artifact.id === artifactId
              ? {
                  ...artifact,
                  sync: { ...artifact.sync, status: 'dirty' as ArtifactSyncStatus },
                }
              : artifact
          ),
        }));
      },

      enqueueArtifactOp: (artifactId, op) => {
        set((s) => ({
          artifacts: s.artifacts.map((artifact) =>
            artifact.id === artifactId
              ? {
                  ...artifact,
                  sync: {
                    ...artifact.sync,
                    status: 'dirty' as ArtifactSyncStatus,
                    pendingOps: [...(artifact.sync?.pendingOps ?? []), op],
                  },
                }
              : artifact
          ),
        }));
      },

      clearPendingOps: (artifactId) => {
        set((s) => ({
          artifacts: s.artifacts.map((artifact) =>
            artifact.id === artifactId
              ? {
                  ...artifact,
                  sync: {
                    ...artifact.sync,
                    status: 'synced' as ArtifactSyncStatus,
                    pendingOps: [],
                    pendingContent: undefined,
                    lastSyncedAt: Date.now(),
                    lastError: undefined,
                  },
                }
              : artifact
          ),
        }));
      },

      setSyncStatus: (artifactId, status, error) => {
        set((s) => ({
          artifacts: s.artifacts.map((artifact) =>
            artifact.id === artifactId
              ? {
                  ...artifact,
                  sync: {
                    ...artifact.sync,
                    status,
                    lastError: error,
                    lastSyncedAt: status === 'synced' ? Date.now() : artifact.sync?.lastSyncedAt,
                  },
                }
              : artifact
          ),
        }));
      },

      mergeServerArtifacts: (serverArtifacts) => {
        set((s) => {
          const byId = new Map(s.artifacts.map((artifact) => [artifact.id, artifact]));

          for (const serverArtifact of serverArtifacts) {
            const existing = byId.get(serverArtifact.id);

            if (!existing) {
              // New artifact from server
              byId.set(serverArtifact.id, {
                ...serverArtifact,
                sync: { status: 'synced' as ArtifactSyncStatus, lastSyncedAt: Date.now() },
              });
              continue;
            }

            // If local artifact is dirty, preserve local content
            if (existing.sync?.status === 'dirty') {
              // Don't overwrite content, but update metadata
              byId.set(serverArtifact.id, {
                ...existing,
                // Update safe metadata from server
                title: serverArtifact.title,
                type: serverArtifact.type,
                status: serverArtifact.status,
                sources: serverArtifact.sources,
                staleness: serverArtifact.staleness,
                executionContext: serverArtifact.executionContext,
                // Keep local content and sync state
              });
            } else {
              // Local is synced, safe to update everything
              byId.set(serverArtifact.id, {
                ...existing,
                ...serverArtifact,
                sync: { status: 'synced' as ArtifactSyncStatus, lastSyncedAt: Date.now() },
              });
            }
          }

          const nextArtifacts = Array.from(byId.values());
          const activeArtifactId =
            s.activeArtifactId && byId.has(s.activeArtifactId)
              ? s.activeArtifactId
              : nextArtifacts[0]?.id ?? null;

          return { artifacts: nextArtifacts, activeArtifactId };
        });
      },

      setFocusId: (artifactId, focusId) => {
        set((s) => ({
          focusedElements: {
            ...s.focusedElements,
            [artifactId]: focusId,
          },
        }));
      },

      // Tab operations
      duplicateArtifact: (id) => {
        const source = get().artifacts.find((a) => a.id === id);
        if (!source) return '';
        const newId = generateId();
        const now = Date.now();
        const versionId = `v-${now}`;
        const duplicate: Artifact = {
          ...source,
          id: newId,
          title: `${source.title} (copy)`,
          versions: [{ id: versionId, content: source.content, timestamp: now, trigger: 'creation' }],
          currentVersionId: versionId,
          iterationHistory: [],
          createdAt: now,
          updatedAt: now,
          opLog: [],
          sync: undefined,
        };
        set((s) => ({
          artifacts: [...s.artifacts, duplicate],
          activeArtifactId: newId,
        }));
        return newId;
      },

      mergeTabs: (sourceId, targetId) => {
        const source = get().artifacts.find((a) => a.id === sourceId);
        const target = get().artifacts.find((a) => a.id === targetId);
        if (!source || !target) return;

        const mergedContent = `${target.content}\n\n---\n\n${source.content}`;
        const now = Date.now();
        const versionId = `v-${now}`;

        set((s) => ({
          artifacts: s.artifacts
            .map((a) =>
              a.id === targetId
                ? {
                    ...a,
                    content: mergedContent,
                    versions: [...a.versions, { id: versionId, content: mergedContent, timestamp: now, trigger: 'manual' as const }],
                    currentVersionId: versionId,
                    updatedAt: now,
                    sync: { ...a.sync, status: 'dirty' as ArtifactSyncStatus },
                  }
                : a
            )
            .filter((a) => a.id !== sourceId),
          activeArtifactId: targetId,
        }));
      },

      branchFromArtifact: (id, newTitle) => {
        const source = get().artifacts.find((a) => a.id === id);
        if (!source) return '';
        const newId = generateId();
        const now = Date.now();
        const versionId = `v-${now}`;
        const branch: Artifact = {
          ...source,
          id: newId,
          title: newTitle ?? `${source.title} (branch)`,
          versions: [{ id: versionId, content: source.content, timestamp: now, trigger: 'creation' }],
          currentVersionId: versionId,
          iterationHistory: [],
          createdAt: now,
          updatedAt: now,
          opLog: [],
          sync: undefined,
        };
        set((s) => ({
          artifacts: [...s.artifacts, branch],
          activeArtifactId: newId,
        }));
        return newId;
      },

      reorderArtifacts: (fromIndex, toIndex) => {
        set((s) => {
          const artifacts = [...s.artifacts];
          const [moved] = artifacts.splice(fromIndex, 1);
          if (!moved) return s;
          artifacts.splice(toIndex, 0, moved);
          return { artifacts };
        });
      },

      // Quick actions
      showArtifact: (artifact) => {
        get().addArtifact(artifact);
      },

      openDocument: (documentId, title, content) => {
        get().addArtifact({
          type: 'document',
          title,
          content,
          format: 'markdown',
          referenceId: documentId,
          referenceType: 'document',
        });
      },

      openEntity: (entityId, name, data) => {
        get().addArtifact({
          type: 'entity',
          title: name,
          content: JSON.stringify(data, null, 2),
          format: 'json',
          referenceId: entityId,
          referenceType: 'entity',
        });
      },

      closePanel: () => set({ panelMode: 'hidden' }),

      reset: () => set(initialState),
    }),
    {
      name: 'artifact-store',
      storage: createJSONStorage(() => createStorageAdapter()),
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as any;
        if (!state || typeof state !== 'object') return state;
        if (!Array.isArray(state.artifacts)) return state;

        state.artifacts = state.artifacts.map((artifact: any) => {
          if (!artifact || typeof artifact !== 'object') return artifact;
          if (artifact.status) return artifact;

          const legacyState = artifact.state;
          if (legacyState === 'applied' || legacyState === 'saved') {
            return { ...artifact, status: legacyState };
          }
          return { ...artifact, status: 'draft' };
        });

        return state;
      },
      partialize: (state) => ({
        panelMode: state.panelMode,
        panelWidth: state.panelWidth,
        artifacts: state.artifacts,
        activeArtifactId: state.activeArtifactId,
        iterationInput: state.iterationInput,
        iterationPillExpanded: state.iterationPillExpanded,
        iterationHistoryVisible: state.iterationHistoryVisible,
      }),
    }
  )
);

// Selectors
export const useArtifactPanelMode = () => useArtifactStore((s) => s.panelMode);
export const useActiveArtifact = () => {
  const artifacts = useArtifactStore((s) => s.artifacts);
  const activeId = useArtifactStore((s) => s.activeArtifactId);
  return artifacts.find((a) => a.id === activeId) ?? null;
};
export const useArtifacts = () => useArtifactStore((s) => s.artifacts);
export const useArtifactFocusId = (artifactId: string) =>
  useArtifactStore((s) => s.focusedElements[artifactId] ?? null);
