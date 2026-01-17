/**
 * InlineCardTabs - Tab navigation for card content
 */

import * as React from "react";
import { cn } from "../../lib/utils";
import type { InlineCardTabsProps } from "./types";

const InlineCardTabs = React.forwardRef<HTMLDivElement, InlineCardTabsProps>(
  ({ tabs, activeTab, onTabChange, accentColor, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-card-tabs",
          "flex gap-2 px-5 py-3",
          "bg-mythos-bg-tertiary/50 border-b border-mythos-border-default/50",
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg",
                "text-xs font-medium whitespace-nowrap",
                "transition-all duration-150",
                isActive
                  ? "bg-mythos-bg-tertiary text-[var(--ic-accent)]"
                  : "text-mythos-text-muted hover:bg-mythos-bg-tertiary/50 hover:text-mythos-text-secondary"
              )}
              onClick={() => onTabChange(tab.id)}
              style={
                isActive && accentColor
                  ? ({ "--ic-accent": accentColor } as React.CSSProperties)
                  : undefined
              }
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--ic-accent)_20%,transparent)] text-[var(--ic-accent)]"
                      : "bg-mythos-bg-tertiary"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
);
InlineCardTabs.displayName = "InlineCardTabs";

export { InlineCardTabs };
