import type { Editor } from "@mythos/editor";

interface ApplyInlineWidgetParams {
  editor: Editor;
  executionId: string;
  widgetId: string;
  projectId: string;
  range: { from: number; to: number };
  content: string;
}

interface ApplyInlineWidgetResult {
  from: number;
  to: number;
  originalText: string;
  appliedText: string;
}

export function applyInlineWidget(
  params: ApplyInlineWidgetParams
): ApplyInlineWidgetResult {
  const { editor, executionId, widgetId, projectId, range, content } = params;
  const safeFrom = Math.max(0, range.from);
  const safeTo = Math.max(safeFrom, range.to);

  const originalText = editor.state.doc.textBetween(safeFrom, safeTo, "\n");

  editor.commands.setExecutionMarkerProjectId(projectId);
  editor
    .chain()
    .focus()
    .insertContentAt({ from: safeFrom, to: safeTo }, content)
    .run();

  const endPos = editor.state.selection.from;
  if (endPos > safeFrom) {
    editor
      .chain()
      .setTextSelection({ from: safeFrom, to: endPos })
      .setExecutionMarker({
        executionId,
        widgetId,
        projectId,
      })
      .run();

    editor.commands.setAppliedHighlight({ from: safeFrom, to: endPos });
    editor.commands.setTextSelection(endPos);
  }

  const appliedText = editor.state.doc.textBetween(safeFrom, endPos, "\n");

  return {
    from: safeFrom,
    to: endPos,
    originalText,
    appliedText,
  };
}
