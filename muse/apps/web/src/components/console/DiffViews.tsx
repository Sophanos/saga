import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@mythos/ui";

/**
 * Diff visualization component for before/after text
 * Displays before and after text in a vertical layout with visual distinction
 */
export function DiffView({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  return (
    <div className="space-y-4">
      {/* Before section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
            Before
          </span>
          <div className="flex-1 h-px bg-mythos-text-muted/20" />
        </div>
        <div
          className={cn(
            "p-3 rounded-md border font-mono text-sm leading-relaxed",
            "bg-mythos-accent-red/5 border-mythos-accent-red/20"
          )}
        >
          <span className="text-mythos-accent-red line-through decoration-2">
            {before}
          </span>
        </div>
      </div>

      {/* Arrow indicator */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-mythos-text-muted">
          <div className="w-8 h-px bg-mythos-text-muted/30" />
          <ArrowRight className="w-4 h-4" />
          <div className="w-8 h-px bg-mythos-text-muted/30" />
        </div>
      </div>

      {/* After section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
            After
          </span>
          <div className="flex-1 h-px bg-mythos-text-muted/20" />
        </div>
        <div
          className={cn(
            "p-3 rounded-md border font-mono text-sm leading-relaxed",
            "bg-mythos-accent-green/5 border-mythos-accent-green/20"
          )}
        >
          <span className="text-mythos-accent-green">
            {after}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline diff visualization showing changes side by side
 * Highlights only the changed portions with a compact layout
 */
export function InlineDiffView({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  // Find common prefix and suffix to highlight only the changed parts
  const diffBounds = useMemo(() => {
    let prefixEnd = 0;

    // Find common prefix
    while (
      prefixEnd < before.length &&
      prefixEnd < after.length &&
      before[prefixEnd] === after[prefixEnd]
    ) {
      prefixEnd++;
    }

    // Find common suffix (but don't overlap with prefix)
    let beforeIdx = before.length - 1;
    let afterIdx = after.length - 1;
    while (
      beforeIdx >= prefixEnd &&
      afterIdx >= prefixEnd &&
      before[beforeIdx] === after[afterIdx]
    ) {
      beforeIdx--;
      afterIdx--;
    }

    const beforeSuffixStart = beforeIdx + 1;
    const afterSuffixStart = afterIdx + 1;

    return {
      prefix: before.substring(0, prefixEnd),
      beforeChanged: before.substring(prefixEnd, beforeSuffixStart),
      afterChanged: after.substring(prefixEnd, afterSuffixStart),
      suffix: before.substring(beforeSuffixStart),
    };
  }, [before, after]);

  const { prefix, beforeChanged, afterChanged, suffix } = diffBounds;

  return (
    <div className="p-3 rounded-md border border-mythos-text-muted/20 bg-mythos-bg-tertiary/30 font-mono text-sm leading-relaxed">
      <span className="text-mythos-text-secondary">{prefix}</span>
      {beforeChanged && (
        <span className="bg-mythos-accent-red/20 text-mythos-accent-red line-through decoration-1 px-0.5 rounded">
          {beforeChanged}
        </span>
      )}
      {afterChanged && (
        <span className="bg-mythos-accent-green/20 text-mythos-accent-green px-0.5 rounded ml-0.5">
          {afterChanged}
        </span>
      )}
      <span className="text-mythos-text-secondary">{suffix}</span>
    </div>
  );
}
