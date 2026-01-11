import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Button, cn } from "@mythos/ui";
import type { Editor } from "@mythos/editor";
import { api } from "../../../../../convex/_generated/api";
import { useMythosStore } from "../../stores";
import { useWidgetExecutionStore } from "../../stores/widgetExecution";
import { ReceiptsBlock } from "./ReceiptsBlock";

const MAX_TITLE_LENGTH = 100;

const ARTIFACT_TYPE_MAP: Record<string, string> = {
  "widget.create-spec": "spec",
  "widget.create-summary": "summary",
  "widget.create-brief": "brief",
  "widget.create-notes": "notes",
  "widget.create-release-notes": "release-notes",
};

function resolveArtifactType(widgetId: string | null): string {
  if (!widgetId) return "document";
  return ARTIFACT_TYPE_MAP[widgetId] ?? "document";
}

export function WidgetPreviewModal() {
  const status = useWidgetExecutionStore((s) => s.status);
  const widgetType = useWidgetExecutionStore((s) => s.widgetType);
  const widgetLabel = useWidgetExecutionStore((s) => s.widgetLabel);
  const previewContent = useWidgetExecutionStore((s) => s.previewContent);
  const manifestDraft = useWidgetExecutionStore((s) => s.manifestDraft);
  const executionId = useWidgetExecutionStore((s) => s.executionId);
  const widgetId = useWidgetExecutionStore((s) => s.currentWidgetId);
  const selection = useWidgetExecutionStore((s) => s.selection);
  const title = useWidgetExecutionStore((s) => s.title);
  const setTitle = useWidgetExecutionStore((s) => s.setTitle);
  const reset = useWidgetExecutionStore((s) => s.reset);

  const editorInstance = useMythosStore((s) => s.editor.editorInstance) as Editor | null;
  const projectId = useMythosStore((s) => s.project.currentProject?.id);
  const createArtifact = useMutation(api.artifacts.createFromExecution);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isOpen = status === "preview" && !!previewContent;
  const ctaLabel = useMemo(() => {
    if (!widgetLabel) return widgetType === "artifact" ? "Create" : "Insert";
    return widgetType === "artifact" ? `Create ${widgetLabel}` : `Insert ${widgetLabel}`;
  }, [widgetLabel, widgetType]);

  if (!isOpen || !previewContent) return null;

  const handleConfirm = async () => {
    setLocalError(null);

    if (widgetType === "inline") {
      if (!editorInstance || editorInstance.isDestroyed) {
        setLocalError("Editor is not available");
        return;
      }
      const range = selection ?? {
        from: editorInstance.state.selection.from,
        to: editorInstance.state.selection.to,
      };
      editorInstance
        .chain()
        .focus()
        .setTextSelection({ from: range.from, to: range.to })
        .insertContent(previewContent)
        .run();
      reset();
      return;
    }

    if (!projectId || !executionId) {
      setLocalError("Missing execution details");
      return;
    }

    setIsSubmitting(true);
    try {
      const resolvedTitle = title.trim() || widgetLabel || "Untitled";
      await createArtifact({
        projectId,
        executionId,
        title: resolvedTitle.slice(0, MAX_TITLE_LENGTH),
        type: resolveArtifactType(widgetId),
      });
      reset();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to create artifact");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="widget-preview-modal">
      <div className="absolute inset-0 bg-mythos-bg-primary/70" onClick={reset} />
      <div className={cn(
        "relative z-10 w-full max-w-2xl mx-4",
        "bg-mythos-bg-secondary border border-mythos-border-default rounded-xl shadow-2xl",
        "flex flex-col max-h-[80vh]"
      )}>
        <div className="px-5 py-4 border-b border-mythos-border-default">
          <div className="text-sm font-medium text-mythos-text-primary">
            {ctaLabel}
          </div>
        </div>

        {widgetType === "artifact" && (
          <div className="px-5 py-3 border-b border-mythos-border-default">
            <input
              value={title}
              onChange={(event) =>
                setTitle(event.target.value.slice(0, MAX_TITLE_LENGTH))
              }
              placeholder="Title"
              data-testid="widget-preview-title"
              className={cn(
                "w-full bg-transparent text-sm text-mythos-text-primary",
                "placeholder:text-mythos-text-muted outline-none"
              )}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <pre className="whitespace-pre-wrap text-sm text-mythos-text-primary">
            {previewContent}
          </pre>
          <ReceiptsBlock manifest={manifestDraft} />
        </div>

        {localError && (
          <div className="px-5 py-2 text-xs text-mythos-accent-red">
            {localError}
          </div>
        )}

        <div className="px-5 py-4 border-t border-mythos-border-default flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={reset} disabled={isSubmitting} data-testid="widget-preview-cancel">
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isSubmitting} data-testid="widget-preview-confirm">
            {isSubmitting ? "Applying..." : ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
