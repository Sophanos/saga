import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ArtifactManifestDraft,
  WidgetExecutionStatus,
  WidgetInvokeRequest,
  WidgetExecutionResult,
} from "@mythos/agent-protocol";
import { useActivityStore } from "@mythos/state";

type WidgetType = WidgetExecutionResult["widgetType"];
import type { Editor } from "@mythos/editor";
import { sendWidgetRunStreaming } from "../services/ai/widgetClient";
import { applyInlineWidget } from "../lib/widgets/applyInlineWidget";

// Helper to sync widget execution to activity store
function syncToActivity(params: {
  executionId: string;
  widgetId: string;
  label: string;
  status: WidgetExecutionStatus;
  documentId?: string | null;
  documentName?: string | null;
  projectId: string;
}) {
  useActivityStore.getState().syncFromWidgetExecution(params);
}

interface WidgetExecutionState {
  status: WidgetExecutionStatus;
  currentWidgetId: string | null;
  widgetType: WidgetType | null;
  widgetLabel: string | null;
  projectId: string | null;
  documentId: string | null;
  selection: { from: number; to: number; text?: string } | null;
  previewContent: string | null;
  partialOutput: string;
  title: string;
  manifestDraft: ArtifactManifestDraft | null;
  clientExecutionId: string | null;
  executionId: string | null;
  error: string | null;
  abortController: AbortController | null;
}

interface InlineApplyResult {
  applied: boolean;
  error?: string;
  executionId?: string;
  originalText?: string;
  appliedText?: string;
}

interface WidgetExecutionActions {
  start: (params: WidgetInvokeRequest & { widgetType: WidgetType; widgetLabel: string }) => void;
  setTitle: (title: string) => void;
  reset: () => void;
  cancel: () => void;
  confirmInlineApply: (editor: Editor | null) => InlineApplyResult;
}

const initialState: WidgetExecutionState = {
  status: "idle",
  currentWidgetId: null,
  widgetType: null,
  widgetLabel: null,
  projectId: null,
  documentId: null,
  selection: null,
  previewContent: null,
  partialOutput: "",
  title: "",
  manifestDraft: null,
  clientExecutionId: null,
  executionId: null,
  error: null,
  abortController: null,
};

export const useWidgetExecutionStore = create<WidgetExecutionState & WidgetExecutionActions>()(
  immer((set, get) => ({
    ...initialState,

    start: (params) => {
      const controller = new AbortController();
      const { widgetId, widgetType, widgetLabel, projectId, documentId, selectionRange, selectionText, parameters } = params;

      // Generate execution ID for activity tracking
      const clientExecutionId = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      set((state) => {
        state.status = "gathering";
        state.currentWidgetId = widgetId;
        state.widgetType = widgetType;
        state.widgetLabel = widgetLabel;
        state.projectId = projectId;
        state.documentId = documentId ?? null;
        state.selection = selectionRange
          ? { ...selectionRange, text: selectionText }
          : null;
        state.previewContent = null;
        state.partialOutput = "";
        state.title = "";
        state.manifestDraft = null;
        state.clientExecutionId = clientExecutionId;
        state.executionId = null;
        state.error = null;
        state.abortController = controller;
      });

      // Sync to activity on start
      syncToActivity({
        executionId: clientExecutionId,
        widgetId,
        label: widgetLabel,
        status: "gathering",
        documentId,
        projectId,
      });

      void sendWidgetRunStreaming(
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
            if (!data || typeof data !== "object") return;
            const payload = data as Record<string, unknown>;
            const stage = payload["stage"];
            if (typeof stage === "string") {
              set((state) => {
                state.status = stage as WidgetExecutionStatus;
              });
              // Sync status change to activity
              const state = get();
              if (state.clientExecutionId && state.currentWidgetId && state.projectId) {
                syncToActivity({
                  executionId: state.clientExecutionId,
                  widgetId: state.currentWidgetId,
                  label: state.widgetLabel ?? "Widget",
                  status: stage as WidgetExecutionStatus,
                  documentId: state.documentId,
                  projectId: state.projectId,
                });
              }
            }

            const result = payload["result"] as {
              executionId?: string;
              widgetType?: WidgetType;
              titleSuggestion?: string;
              manifestDraft?: ArtifactManifestDraft | null;
            } | undefined;

              if (result) {
              set((state) => {
                state.status = "preview";
                state.executionId = result.executionId ?? state.executionId;
                state.widgetType = result.widgetType ?? state.widgetType;
                state.previewContent = state.partialOutput || state.previewContent;
                state.title = result.titleSuggestion ?? state.title;
                state.manifestDraft = result.manifestDraft ?? state.manifestDraft;
              });
              // Sync preview status to activity
              const state = get();
              if (state.clientExecutionId && state.currentWidgetId && state.projectId) {
                syncToActivity({
                  executionId: state.clientExecutionId,
                  widgetId: state.currentWidgetId,
                  label: state.widgetLabel ?? "Widget",
                  status: "preview",
                  documentId: state.documentId,
                  projectId: state.projectId,
                });
              }
            }
          },
          onDelta: (content) => {
            set((state) => {
              state.partialOutput += content;
            });
          },
          onDone: () => {
            const { status, partialOutput, previewContent } = get();
            if (status !== "preview" && partialOutput && !previewContent) {
              set((state) => {
                state.status = "preview";
                state.previewContent = partialOutput;
              });
            }
          },
          onError: (error) => {
            set((state) => {
              state.status = "error";
              state.error = error.message;
            });
            // Sync error to activity
            const state = get();
            if (state.clientExecutionId && state.currentWidgetId && state.projectId) {
              syncToActivity({
                executionId: state.clientExecutionId,
                widgetId: state.currentWidgetId,
                label: state.widgetLabel ?? "Widget",
                status: "error",
                documentId: state.documentId,
                projectId: state.projectId,
              });
            }
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

    confirmInlineApply: (editor) => {
      const { previewContent, selection, currentWidgetId, projectId, executionId, widgetLabel, documentId } = get();
      if (!editor || editor.isDestroyed) {
        return { applied: false, error: "Editor is not available" };
      }
      if (!previewContent) {
        return { applied: false, error: "No preview content to apply" };
      }
      if (!currentWidgetId) {
        return { applied: false, error: "Widget is not set" };
      }
      if (!projectId) {
        return { applied: false, error: "Project is not set" };
      }
      if (!executionId) {
        return { applied: false, error: "Execution is not ready" };
      }

      const range = selection ?? {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };

      const result = applyInlineWidget({
        editor,
        executionId,
        widgetId: currentWidgetId,
        projectId,
        range,
        content: previewContent,
      });

      // Sync applied/done status to activity
      syncToActivity({
        executionId: get().clientExecutionId ?? executionId,
        widgetId: currentWidgetId,
        label: widgetLabel ?? "Widget",
        status: "done",
        documentId,
        projectId,
      });

      return {
        applied: true,
        executionId,
        originalText: result.originalText,
        appliedText: result.appliedText,
      };
    },
  }))
);
