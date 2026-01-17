/**
 * InboxSection - Collapsible section with header and count
 *
 * Cursor/Notion-style section headers with uppercase labels,
 * count badges, and optional bulk actions.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@mythos/ui";

interface InboxSectionAction {
  label: string;
  onClick: () => void;
}

interface InboxSectionProps {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  action?: InboxSectionAction;
  children: React.ReactNode;
  className?: string;
}

export function InboxSection({
  title,
  count,
  defaultExpanded = true,
  collapsible = true,
  action,
  children,
  className,
}: InboxSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Don't render section if no children (empty state handled elsewhere)
  const hasContent = Boolean(children);
  if (!hasContent) return null;

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className={cn("py-1", className)}>
      {/* Section Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2",
          collapsible && "cursor-pointer select-none",
          "group"
        )}
        onClick={handleToggle}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? isExpanded : undefined}
      >
        <div className="flex items-center gap-2">
          {/* Collapse indicator */}
          {collapsible && (
            <span className="text-mythos-text-ghost transition-transform duration-150">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}

          {/* Section title */}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-mythos-text-muted">
            {title}
          </span>

          {/* Count badge */}
          {count !== undefined && count > 0 && (
            <span className="text-[10px] font-medium text-mythos-text-ghost tabular-nums">
              {count}
            </span>
          )}
        </div>

        {/* Section action */}
        {action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            className={cn(
              "text-xs text-mythos-text-muted",
              "hover:text-mythos-text-secondary",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-150"
            )}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Section content */}
      {isExpanded && <div className="animate-in fade-in-0 duration-150">{children}</div>}
    </div>
  );
}

/**
 * Divider between sections
 */
export function InboxSectionDivider() {
  return <div className="mx-4 my-1 border-t border-mythos-border-subtle" />;
}

/**
 * Section with controlled expansion state
 */
interface ControlledInboxSectionProps extends Omit<InboxSectionProps, "defaultExpanded"> {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ControlledInboxSection({
  title,
  count,
  isExpanded,
  onToggle,
  collapsible = true,
  action,
  children,
  className,
}: ControlledInboxSectionProps) {
  const hasContent = Boolean(children);
  if (!hasContent) return null;

  return (
    <div className={cn("py-1", className)}>
      {/* Section Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2",
          collapsible && "cursor-pointer select-none",
          "group"
        )}
        onClick={collapsible ? onToggle : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? isExpanded : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <span className="text-mythos-text-ghost transition-transform duration-150">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}

          <span className="text-[11px] font-semibold uppercase tracking-wider text-mythos-text-muted">
            {title}
          </span>

          {count !== undefined && count > 0 && (
            <span className="text-[10px] font-medium text-mythos-text-ghost tabular-nums">
              {count}
            </span>
          )}
        </div>

        {action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            className={cn(
              "text-xs text-mythos-text-muted",
              "hover:text-mythos-text-secondary",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-150"
            )}
          >
            {action.label}
          </button>
        )}
      </div>

      {isExpanded && <div className="animate-in fade-in-0 duration-150">{children}</div>}
    </div>
  );
}
