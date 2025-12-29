import { FileText, Quote, X } from "lucide-react";
import { cn } from "@mythos/ui";

interface ContextBarProps {
  documentTitle?: string;
  selectionText?: string;
  onClearSelection?: () => void;
  className?: string;
}

/**
 * Shows the current document and selection context for the AI chat
 */
export function ContextBar({
  documentTitle,
  selectionText,
  onClearSelection,
  className,
}: ContextBarProps) {
  const hasContext = documentTitle || selectionText;

  if (!hasContext) return null;

  const truncatedSelection = selectionText
    ? selectionText.length > 100
      ? selectionText.slice(0, 100) + "..."
      : selectionText
    : null;

  return (
    <div
      className={cn(
        "px-3 py-2 border-b border-mythos-text-muted/20 bg-mythos-bg-tertiary/50",
        className
      )}
    >
      <div className="flex items-start gap-2 text-xs">
        {documentTitle && (
          <div className="flex items-center gap-1.5 text-mythos-text-secondary">
            <FileText className="w-3 h-3 text-mythos-accent-cyan shrink-0" />
            <span className="truncate max-w-[150px]">{documentTitle}</span>
          </div>
        )}

        {documentTitle && truncatedSelection && (
          <span className="text-mythos-text-muted">·</span>
        )}

        {truncatedSelection && (
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <Quote className="w-3 h-3 text-mythos-accent-purple shrink-0 mt-0.5" />
            <span className="text-mythos-text-muted italic line-clamp-2">
              "{truncatedSelection}"
            </span>
            {onClearSelection && (
              <button
                onClick={onClearSelection}
                className="shrink-0 p-0.5 hover:bg-mythos-bg-tertiary rounded"
                title="Clear selection"
              >
                <X className="w-3 h-3 text-mythos-text-muted" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
