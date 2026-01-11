import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  ArtifactManifestDraft,
  WidgetExecutionStatus,
  WidgetInvokeRequest,
  WidgetType,
} from "@mythos/agent-protocol";
import type { Editor } from "@mythos/editor";
import { sendWidgetRunStreaming } from "../services/ai/widgetClient";
import { applyInlineWidget } from "../lib/widgets/applyInlineWidget";

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
        state.executionId = null;
        state.error = null;
        state.abortController = controller;
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
            const stage = payload.stage;
            if (typeof stage === "string") {
              set((state) => {
                state.status = stage as WidgetExecutionStatus;
              });
            }

            const result = payload.result as {
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
      const { previewContent, selection, currentWidgetId, projectId, executionId } = get();
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

      return {
        applied: true,
        executionId,
        originalText: result.originalText,
        appliedText: result.appliedText,
      };
    },
  }))
);
