/**
 * InlineCardContent - Expandable content area with optional scroll
 */

import * as React from "react";
import { cn } from "../../lib/utils";
import type { InlineCardContentProps } from "./types";

const InlineCardContent = React.forwardRef<HTMLDivElement, InlineCardContentProps>(
  ({ maxHeight = 280, className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-card-content",
          "px-5 py-4 overflow-y-auto overflow-x-hidden",
          className
        )}
        style={{
          maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
        }}
      >
        {children}
      </div>
    );
  }
);
InlineCardContent.displayName = "InlineCardContent";

export { InlineCardContent };
