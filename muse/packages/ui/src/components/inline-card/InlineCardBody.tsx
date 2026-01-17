/**
 * InlineCardBody - Animated expandable body container
 *
 * Uses CSS grid for smooth height transitions.
 */

import * as React from "react";
import { cn } from "../../lib/utils";

export interface InlineCardBodyProps {
  /** Whether the body is expanded */
  isExpanded?: boolean;
  /** Additional class names */
  className?: string;
  children?: React.ReactNode;
}

const InlineCardBody = React.forwardRef<HTMLDivElement, InlineCardBodyProps>(
  ({ isExpanded = true, className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-card-body",
          "grid transition-[grid-template-rows] duration-250 ease-out",
          "border-t border-transparent",
          isExpanded
            ? "grid-rows-[1fr] border-mythos-border-default/50"
            : "grid-rows-[0fr]",
          className
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    );
  }
);
InlineCardBody.displayName = "InlineCardBody";

export { InlineCardBody };
