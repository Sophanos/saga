import { useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@mythos/ui";
import {
  useActivityStore,
  useActivityOpen,
  useNeedsAttentionCount,
  useHasRunningWidgets,
} from "@mythos/state";
import { ActivityInbox } from "./ActivityInbox";

export function ActivityBell() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isOpen = useActivityOpen();
  const toggle = useActivityStore((s) => s.toggle);
  const close = useActivityStore((s) => s.close);
  const needsAttentionCount = useNeedsAttentionCount();
  const hasRunning = useHasRunningWidgets();

  const showBadge = needsAttentionCount > 0;
  const showPulse = hasRunning && !showBadge;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-md cursor-pointer",
          "transition-colors duration-150",
          "text-mythos-text-secondary hover:text-mythos-text-primary",
          "hover:bg-mythos-bg-tertiary",
          isOpen && "bg-mythos-bg-tertiary text-mythos-text-primary",
          showBadge && "text-mythos-accent-primary hover:text-mythos-accent-primary"
        )}
        aria-label={`Activity${needsAttentionCount > 0 ? ` (${needsAttentionCount} items need attention)` : ""}`}
        data-testid="activity-bell"
      >
        <Bell className={cn("w-4 h-4", showPulse && "animate-pulse")} />

        {/* Badge */}
        {showBadge && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5",
              "min-w-[16px] h-4 px-1",
              "flex items-center justify-center",
              "text-[10px] font-medium leading-none",
              "bg-mythos-accent-primary text-white",
              "rounded-full"
            )}
          >
            {needsAttentionCount > 9 ? "9+" : needsAttentionCount}
          </span>
        )}

        {/* Running indicator dot (when no badge) */}
        {showPulse && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5",
              "w-2 h-2 rounded-full",
              "bg-mythos-accent-primary",
              "animate-pulse"
            )}
          />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
          <div className="fixed top-[55px] right-4 z-50">
            <ActivityInbox />
          </div>
        </>
      )}
    </div>
  );
}
