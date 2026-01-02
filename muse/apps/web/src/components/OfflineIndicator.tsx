/**
 * OfflineIndicator component
 * Shows online/offline status with sync information
 */

import { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useOfflineIndicatorData, formatTimeSinceSync } from "@mythos/state";

/**
 * Tooltip component for displaying sync details
 */
function Tooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute top-full right-0 mt-2 z-50">
          <div className="bg-mythos-bg-primary border border-mythos-border-default rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * OfflineIndicator component
 *
 * Shows:
 * - Online/offline status with icon
 * - Pending mutations count if any
 * - Sync error if any
 * - "Syncing..." spinner when syncing
 * - Tooltip with last sync time
 *
 * @example
 * ```tsx
 * <OfflineIndicator />
 * ```
 */
export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, hasError, lastSyncAt } =
    useOfflineIndicatorData();
  const [formattedTime, setFormattedTime] = useState(() =>
    formatTimeSinceSync(lastSyncAt)
  );

  // Update formatted time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setFormattedTime(formatTimeSinceSync(lastSyncAt));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [lastSyncAt]);

  // Update immediately when lastSyncAt changes
  useEffect(() => {
    setFormattedTime(formatTimeSinceSync(lastSyncAt));
  }, [lastSyncAt]);

  // Determine status and appearance
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: "Offline",
        className: "text-mythos-text-muted",
        bgClassName: "bg-mythos-text-muted/10",
      };
    }

    if (hasError) {
      return {
        icon: AlertCircle,
        label: "Sync Error",
        className: "text-mythos-accent-red",
        bgClassName: "bg-mythos-accent-red/10",
      };
    }

    if (isSyncing) {
      return {
        icon: RefreshCw,
        label: "Syncing...",
        className: "text-mythos-accent-cyan animate-spin",
        bgClassName: "bg-mythos-accent-cyan/10",
      };
    }

    if (pendingCount > 0) {
      return {
        icon: Clock,
        label: `${pendingCount} pending`,
        className: "text-mythos-accent-yellow",
        bgClassName: "bg-mythos-accent-yellow/10",
      };
    }

    return {
      icon: CheckCircle2,
      label: "Synced",
      className: "text-mythos-accent-green",
      bgClassName: "bg-mythos-accent-green/10",
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  // Build tooltip content
  const tooltipContent = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="w-3 h-3 text-mythos-accent-green" />
        ) : (
          <WifiOff className="w-3 h-3 text-mythos-text-muted" />
        )}
        <span className="text-mythos-text-primary">
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>
      <div className="flex items-center gap-2 text-mythos-text-secondary">
        <Clock className="w-3 h-3" />
        <span>Last sync: {formattedTime}</span>
      </div>
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 text-mythos-accent-yellow">
          <RefreshCw className="w-3 h-3" />
          <span>{pendingCount} changes pending</span>
        </div>
      )}
      {hasError && (
        <div className="flex items-center gap-2 text-mythos-accent-red">
          <AlertCircle className="w-3 h-3" />
          <span>Sync failed - will retry</span>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <div
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-md
          ${status.bgClassName}
          transition-colors duration-200
        `}
      >
        <StatusIcon className={`w-3.5 h-3.5 ${status.className}`} />
        <span
          className={`text-xs font-medium ${status.className} hidden sm:inline`}
        >
          {status.label}
        </span>
        {pendingCount > 0 && !isSyncing && isOnline && !hasError && (
          <span className="text-xs text-mythos-accent-yellow ml-0.5">
            ({pendingCount})
          </span>
        )}
      </div>
    </Tooltip>
  );
}

export default OfflineIndicator;
