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

export type ArtifactState = 'draft' | 'iterating' | 'applied' | 'saved' | 'stale';

// Iteration message in mini-chat
export interface IterationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  context?: {
    artifactId: string;
    artifactContent: string;
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

  // State
  state: ArtifactState;

  // Iteration
  iterationHistory: IterationMessage[];
  versions: ArtifactVersion[];
  currentVersionId: string;

  // Metadata
  createdAt: number;
  updatedAt: number;

  // Source info
  source?: {
    tool?: string;
    model?: string;
    threadId?: string;
  };

  // RAS validation + ops
  validationErrors?: string[];
  opLog: ArtifactOpLogEntry[];

  // Reference to opened content
  referenceId?: string; // document or entity ID
  referenceType?: 'document' | 'entity';
}

// Panel mode
export type ArtifactPanelMode = 'hidden' | 'side' | 'floating';

interface ArtifactStore {
  // Panel state
  panelMode: ArtifactPanelMode;
  panelWidth: number;
  setPanelMode: (mode: ArtifactPanelMode) => void;
  setPanelWidth: (width: number) => void;
  togglePanel: () => void;

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
  setActiveArtifact: (id: string | null) => void;

  // CRUD
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt' | 'versions' | 'currentVersionId' | 'iterationHistory' | 'state' | 'opLog' | 'validationErrors'>) => string;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
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

  // Quick actions
  showArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt' | 'updatedAt' | 'versions' | 'currentVersionId' | 'iterationHistory' | 'state' | 'opLog' | 'validationErrors'>) => void;
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
  artifacts: [] as Artifact[],
  activeArtifactId: null as string | null,
  iterationInput: '',
  iterationPillExpanded: false,
  iterationHistoryVisible: true,
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

      // Iteration pill
      setIterationInput: (value) => set({ iterationInput: value }),
      setIterationPillExpanded: (expanded) => set({ iterationPillExpanded: expanded }),
      setIterationHistoryVisible: (visible) => set({ iterationHistoryVisible: visible }),

      // Active
      setActiveArtifact: (id) => set({ activeArtifactId: id }),

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
          state: 'draft',
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
                  state: 'iterating' as ArtifactState,
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
            };
          }),
        }));
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
