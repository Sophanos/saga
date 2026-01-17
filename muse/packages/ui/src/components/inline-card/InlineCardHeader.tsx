/**
 * InlineCardHeader - Header with icon, title, badge, and action buttons
 */

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { InlineCardHeaderProps } from "./types";

const InlineCardHeader = React.forwardRef<HTMLDivElement, InlineCardHeaderProps>(
  (
    {
      icon,
      title,
      badge,
      subtitle,
      actions,
      onClose,
      onClick,
      showActions = false,
      accentColor,
      accentBg,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-card-header",
          "flex items-center gap-2 px-4 py-3",
          onClick && "cursor-pointer hover:bg-mythos-bg-tertiary/50",
          "transition-colors duration-100",
          className
        )}
        onClick={onClick}
      >
        {/* Close button */}
        {onClose && (
          <button
            type="button"
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded",
              "text-mythos-text-muted hover:text-mythos-text-primary",
              "hover:bg-red-500/15 hover:text-red-500",
              "transition-all duration-150"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Remove"
          >
            <X size={12} />
          </button>
        )}

        {/* Icon */}
        {icon && (
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
              "bg-[var(--ic-accent-bg)]"
            )}
            style={
              accentBg ? ({ "--ic-accent-bg": accentBg } as React.CSSProperties) : undefined
            }
          >
            {icon}
          </div>
        )}

        {/* Title group */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <span className="text-sm font-semibold text-mythos-text-primary truncate tracking-tight">
            {title}
          </span>
          {badge && (
            <span
              className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded shrink-0",
                "bg-[var(--ic-accent-bg)] text-[var(--ic-accent)]",
                "capitalize tracking-wide"
              )}
              style={
                accentColor && accentBg
                  ? ({
                      "--ic-accent": accentColor,
                      "--ic-accent-bg": accentBg,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {badge}
            </span>
          )}
          {subtitle && (
            <span className="text-[11px] text-mythos-text-muted truncate italic">
              {subtitle}
            </span>
          )}
        </div>

        {/* Actions slot */}
        {actions && (
          <div
            className={cn(
              "flex gap-0.5 shrink-0 transition-opacity duration-150",
              showActions ? "opacity-100" : "opacity-0"
            )}
          >
            {actions}
          </div>
        )}
      </div>
    );
  }
);
InlineCardHeader.displayName = "InlineCardHeader";

export { InlineCardHeader };
