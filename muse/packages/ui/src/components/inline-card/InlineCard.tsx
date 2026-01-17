/**
 * InlineCard - Unified card component for entities, widgets, and artifact links
 *
 * Composable shell that wraps header, content, tabs, and actions.
 * Uses CSS variables for accent colors to support entity-specific theming.
 */

import * as React from "react";
import { cn } from "../../lib/utils";
import type { InlineCardProps } from "./types";

const InlineCard = React.forwardRef<HTMLDivElement, InlineCardProps>(
  (
    {
      variant = "entity",
      accentColor,
      accentBg,
      isExpanded = true,
      isPinned = false,
      isHovered = false,
      onHoverChange,
      className,
      children,
    },
    ref
  ) => {
    const colorVars = {
      "--ic-accent": accentColor ?? "var(--color-accent)",
      "--ic-accent-bg": accentBg ?? "var(--color-accent-bg)",
    } as React.CSSProperties;

    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "inline-card",
          "relative rounded-xl border bg-mythos-bg-secondary overflow-hidden isolate",
          "transition-all duration-150 ease-out",
          // Border
          "border-mythos-border-default",
          // Shadow
          "shadow-sm",
          // Hover state
          isHovered && [
            "border-[color-mix(in_srgb,var(--ic-accent)_50%,transparent)]",
            "shadow-md",
          ],
          // Variant-specific
          variant === "artifact-link" && "cursor-pointer",
          className
        )}
        style={colorVars}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        data-variant={variant}
        data-expanded={isExpanded}
        data-pinned={isPinned}
      >
        {children}
      </div>
    );
  }
);
InlineCard.displayName = "InlineCard";

export { InlineCard };
