import * as React from "react";
import { cn } from "../lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface AvatarProps {
  /** User's display name - used for alt text and initials generation */
  name?: string;
  /** URL of the user's avatar image */
  avatarUrl?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom className for additional styling */
  className?: string;
  /** Custom background color for initials fallback (hex or CSS color) */
  color?: string;
  /** Whether the user is currently online */
  isOnline?: boolean;
  /** Whether to show the online status indicator dot */
  showOnlineIndicator?: boolean;
}

// ============================================================================
// Size Configuration
// ============================================================================

const sizeConfig = {
  sm: {
    container: "w-7 h-7",
    text: "text-xs",
    indicator: "w-2.5 h-2.5 -bottom-0.5 -right-0.5",
  },
  md: {
    container: "w-8 h-8",
    text: "text-sm",
    indicator: "w-3 h-3 -bottom-0.5 -right-0.5",
  },
  lg: {
    container: "w-10 h-10",
    text: "text-base",
    indicator: "w-3.5 h-3.5 -bottom-0.5 -right-0.5",
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate initials from a name string.
 * Takes the first letter of each word (up to 2 letters).
 */
function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Avatar Component
// ============================================================================

/**
 * Avatar component for displaying user profile images with fallback to initials.
 * Supports multiple sizes, custom colors, and online status indicators.
 */
const Avatar = React.memo(function Avatar({
  name,
  avatarUrl,
  size = "sm",
  className,
  color,
  isOnline = false,
  showOnlineIndicator = false,
}: AvatarProps) {
  const config = sizeConfig[size];
  const initials = getInitials(name);

  const containerClasses = cn(
    config.container,
    config.text,
    "rounded-full",
    className
  );

  return (
    <div className="relative inline-flex flex-shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || "User avatar"}
          className={cn(
            containerClasses,
            "object-cover border-2 border-mythos-bg-primary"
          )}
        />
      ) : (
        <div
          className={cn(
            containerClasses,
            "flex items-center justify-center font-medium border-2 border-mythos-bg-primary"
          )}
          style={{
            backgroundColor: color || "rgba(34, 211, 238, 0.3)", // mythos-accent-cyan/30
            color: color ? "#fff" : "rgb(34, 211, 238)", // white if custom color, cyan otherwise
          }}
        >
          {initials}
        </div>
      )}
      {showOnlineIndicator && (
        <span
          className={cn(
            "absolute rounded-full border-2 border-mythos-bg-primary",
            config.indicator,
            isOnline
              ? "bg-mythos-accent-green"
              : "bg-mythos-text-muted"
          )}
          aria-label={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
});

Avatar.displayName = "Avatar";

export { Avatar, getInitials };
