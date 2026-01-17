/**
 * InlineCardActions - Action button container and individual buttons
 */

import * as React from "react";
import { cn } from "../../lib/utils";
import type { InlineCardActionsProps, InlineCardActionButtonProps } from "./types";

const InlineCardActions = React.forwardRef<HTMLDivElement, InlineCardActionsProps>(
  ({ visible = true, className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-card-actions",
          "flex gap-0.5 transition-opacity duration-150",
          visible ? "opacity-100" : "opacity-0",
          className
        )}
      >
        {children}
      </div>
    );
  }
);
InlineCardActions.displayName = "InlineCardActions";

const InlineCardActionButton = React.forwardRef<
  HTMLButtonElement,
  InlineCardActionButtonProps
>(({ icon, label, onClick, active = false, variant = "default", className }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex items-center justify-center w-[26px] h-[26px] rounded",
        "text-mythos-text-muted transition-all duration-100",
        // Default variant
        variant === "default" && [
          "hover:bg-mythos-bg-tertiary hover:text-mythos-text-primary",
          active && "text-[var(--ic-accent)] bg-[color-mix(in_srgb,var(--ic-accent)_15%,transparent)]",
          active && "hover:bg-[color-mix(in_srgb,var(--ic-accent)_20%,transparent)] hover:text-[var(--ic-accent)]",
        ],
        // Danger variant
        variant === "danger" && "hover:bg-red-500/15 hover:text-red-500",
        className
      )}
      onClick={onClick}
      title={label}
    >
      {icon}
    </button>
  );
});
InlineCardActionButton.displayName = "InlineCardActionButton";

export { InlineCardActions, InlineCardActionButton };
