/**
 * InboxBell - Bell icon trigger for the Inbox panel
 *
 * Features:
 * - Badge count for items needing attention
 * - Pulse animation when widgets are running
 * - Opens Inbox panel on click
 */

import { useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@mythos/ui";
import {
  useInboxStore,
  useInboxOpen,
  useTotalInboxCount,
  useHasRunningActivity,
} from "@mythos/state";
import { Inbox } from "./Inbox";

interface InboxBellProps {
  onNavigateToDocument?: (documentId: string) => void;
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToArtifact?: (artifactId: string) => void;
  className?: string;
}

export function InboxBell({
  onNavigateToDocument,
  onNavigateToEntity,
  onNavigateToArtifact,
  className,
}: InboxBellProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isOpen = useInboxOpen();
  const toggle = useInboxStore((s) => s.toggle);
  const close = useInboxStore((s) => s.close);
  const totalCount = useTotalInboxCount();
  const hasRunning = useHasRunningActivity();

  const showBadge = totalCount > 0;
  const showPulse = hasRunning && !showBadge;

  return (
    <div className={cn("relative", className)}>
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
        aria-label={`Inbox${totalCount > 0 ? ` (${totalCount} items)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        data-testid="inbox-bell"
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
              "rounded-full",
              "animate-in zoom-in-50 duration-150"
            )}
          >
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}

        {/* Running indicator dot (when no badge) */}
        {showPulse && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5",
              "w-2 h-2 rounded-full",
              "bg-amber-400",
              "animate-pulse"
            )}
          />
        )}
      </button>

      {/* Inbox Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="fixed top-[55px] right-4 z-50">
            <Inbox
              onClose={close}
              onNavigateToDocument={(docId) => {
                onNavigateToDocument?.(docId);
                close();
              }}
              onNavigateToEntity={(entityId) => {
                onNavigateToEntity?.(entityId);
                close();
              }}
              onNavigateToArtifact={(artifactId) => {
                onNavigateToArtifact?.(artifactId);
                close();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Minimal InboxBell for compact headers
 */
interface InboxBellMinimalProps {
  count?: number;
  isRunning?: boolean;
  onClick?: () => void;
  className?: string;
}

export function InboxBellMinimal({
  count = 0,
  isRunning = false,
  onClick,
  className,
}: InboxBellMinimalProps) {
  const showBadge = count > 0;
  const showPulse = isRunning && !showBadge;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center w-7 h-7 rounded-md cursor-pointer",
        "transition-colors duration-150",
        "text-mythos-text-secondary hover:text-mythos-text-primary",
        "hover:bg-mythos-bg-tertiary",
        showBadge && "text-mythos-accent-primary hover:text-mythos-accent-primary",
        className
      )}
      aria-label={`Inbox${count > 0 ? ` (${count} items)` : ""}`}
    >
      <Bell className={cn("w-3.5 h-3.5", showPulse && "animate-pulse")} />

      {showBadge && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5",
            "min-w-[14px] h-3.5 px-0.5",
            "flex items-center justify-center",
            "text-[9px] font-medium leading-none",
            "bg-mythos-accent-primary text-white",
            "rounded-full"
          )}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}

      {showPulse && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5",
            "w-1.5 h-1.5 rounded-full",
            "bg-amber-400",
            "animate-pulse"
          )}
        />
      )}
    </button>
  );
}
