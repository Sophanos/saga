/**
 * Widget Execution Store
 *
 * Platform-agnostic state management for widget execution.
 * The actual streaming client is provided by the platform (web/expo).
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ArtifactManifestDraft,
  WidgetExecutionStatus,
  WidgetInvokeRequest,
} from '@mythos/agent-protocol';

// =============================================================================
// Types
// =============================================================================

export type WidgetType = 'inline' | 'artifact';

export interface WidgetSelection {
  from: number;
  to: number;
  text?: string;
}

export interface WidgetExecutionState {
  status: WidgetExecutionStatus;
  currentWidgetId: string | null;
  widgetType: WidgetType | null;
  widgetLabel: string | null;
  projectId: string | null;
  documentId: string | null;
  selection: WidgetSelection | null;
  previewContent: string | null;
  partialOutput: string;
  title: string;
  manifestDraft: ArtifactManifestDraft | null;
  executionId: string | null;
  error: string | null;
  abortController: AbortController | null;
}

export interface WidgetStartParams extends WidgetInvokeRequest {
  widgetType: WidgetType;
  widgetLabel: string;
}

export interface WidgetContextData {
  stage?: WidgetExecutionStatus;
  result?: {
    executionId?: string;
    widgetType?: WidgetType;
    titleSuggestion?: string;
    manifestDraft?: ArtifactManifestDraft | null;
  };
}

export type WidgetStreamExecutor = (
  payload: WidgetInvokeRequest,
  callbacks: {
    signal: AbortSignal;
    onContext: (data: WidgetContextData) => void;
    onDelta: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  }
) => void;

export interface WidgetExecutionActions {
  start: (params: WidgetStartParams, executor: WidgetStreamExecutor) => void;
  setTitle: (title: string) => void;
  reset: () => void;
  cancel: () => void;
  getApplyData: () => {
    previewContent: string | null;
    selection: WidgetSelection | null;
    currentWidgetId: string | null;
    projectId: string | null;
    executionId: string | null;
  };
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: WidgetExecutionState = {
  status: 'idle',
  currentWidgetId: null,
  widgetType: null,
  widgetLabel: null,
  projectId: null,
  documentId: null,
  selection: null,
  previewContent: null,
  partialOutput: '',
  title: '',
  manifestDraft: null,
  executionId: null,
  error: null,
  abortController: null,
};

// =============================================================================
// Store
// =============================================================================

export const useWidgetExecutionStore = create<WidgetExecutionState & WidgetExecutionActions>()(
  immer((set, get) => ({
    ...initialState,

    start: (params, executor) => {
      const controller = new AbortController();
      const {
        widgetId,
        widgetType,
        widgetLabel,
        projectId,
        documentId,
        selectionRange,
        selectionText,
        parameters,
      } = params;

      set((state) => {
        state.status = 'gathering';
        state.currentWidgetId = widgetId;
        state.widgetType = widgetType;
        state.widgetLabel = widgetLabel;
        state.projectId = projectId;
        state.documentId = documentId ?? null;
        state.selection = selectionRange ? { ...selectionRange, text: selectionText } : null;
        state.previewContent = null;
        state.partialOutput = '';
        state.title = '';
        state.manifestDraft = null;
        state.executionId = null;
        state.error = null;
        state.abortController = controller;
      });

      executor(
        {
          widgetId,
          projectId,
          documentId,
          selectionText,
          selectionRange,
          parameters,
        },
        {
          signal: controller.signal,
          onContext: (data) => {
            if (!data || typeof data !== 'object') return;

            const stage = data.stage;
            if (stage) {
              set((state) => {
                state.status = stage;
              });
            }

            const result = data.result;
            if (result) {
              set((state) => {
                state.status = 'preview';
                state.executionId = result.executionId ?? state.executionId;
                state.widgetType = result.widgetType ?? state.widgetType;
                state.previewContent = state.partialOutput || state.previewContent;
                state.title = result.titleSuggestion ?? state.title;
                state.manifestDraft = result.manifestDraft ?? state.manifestDraft;
              });
            }
          },
          onDelta: (content) => {
            set((state) => {
              state.partialOutput += content;
            });
          },
          onDone: () => {
            const { status, partialOutput, previewContent } = get();
            if (status !== 'preview' && partialOutput && !previewContent) {
              set((state) => {
                state.status = 'preview';
                state.previewContent = partialOutput;
              });
            }
          },
          onError: (error) => {
            set((state) => {
              state.status = 'error';
              state.error = error.message;
            });
          },
        }
      );
    },

    setTitle: (title) =>
      set((state) => {
        state.title = title;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, initialState);
      }),

    cancel: () => {
      const controller = get().abortController;
      controller?.abort();
      set((state) => {
        Object.assign(state, initialState);
      });
    },

    getApplyData: () => {
      const { previewContent, selection, currentWidgetId, projectId, executionId } = get();
      return { previewContent, selection, currentWidgetId, projectId, executionId };
    },
  }))
);

// =============================================================================
// Selectors
// =============================================================================

export const useWidgetStatus = () => useWidgetExecutionStore((s) => s.status);
export const useWidgetPreviewContent = () => useWidgetExecutionStore((s) => s.previewContent);
export const useWidgetLabel = () => useWidgetExecutionStore((s) => s.widgetLabel);
export const useWidgetType = () => useWidgetExecutionStore((s) => s.widgetType);
export const useWidgetError = () => useWidgetExecutionStore((s) => s.error);
export const useWidgetTitle = () => useWidgetExecutionStore((s) => s.title);
export const useWidgetManifestDraft = () => useWidgetExecutionStore((s) => s.manifestDraft);
