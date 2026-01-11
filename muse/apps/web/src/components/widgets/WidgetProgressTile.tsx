import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@mythos/ui";
import { useWidgetExecutionStore } from "../../stores/widgetExecution";

const STAGE_LABELS: Record<string, string> = {
  gathering: "Gathering context",
  generating: "Generating",
  formatting: "Formatting",
};

export function WidgetProgressTile() {
  const status = useWidgetExecutionStore((s) => s.status);
  const widgetLabel = useWidgetExecutionStore((s) => s.widgetLabel);
  const cancel = useWidgetExecutionStore((s) => s.cancel);

  const stageLabel = useMemo(() => STAGE_LABELS[status] ?? "Working", [status]);

  if (status !== "gathering" && status !== "generating" && status !== "formatting") {
    return null;
  }

  return (
    <div
      data-testid="widget-progress-tile"
      className={cn(
      "fixed bottom-6 right-6 z-50",
      "bg-mythos-bg-secondary border border-mythos-border-default",
      "rounded-xl shadow-lg px-4 py-3 w-[280px]"
    )}
    >
      <div className="flex items-start gap-3">
        <Loader2 className="w-4 h-4 text-mythos-accent-primary animate-spin mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-mythos-text-primary">
            {widgetLabel ?? "Widget"}
          </div>
          <div className="text-xs text-mythos-text-muted">{stageLabel}</div>
        </div>
        <button
          onClick={cancel}
          className="text-xs text-mythos-text-muted hover:text-mythos-text-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
