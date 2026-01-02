import { useMemo } from "react";
import { cn } from "@mythos/ui";
import { text, border, accent } from "@mythos/theme";
import {
  getCapabilitiesForSurface,
  getCapabilityIcon,
  type Capability,
} from "@mythos/capabilities";

interface QuickActionsProps {
  hasSelection: boolean;
  hasApiKey: boolean;
  onInvoke: (capability: Capability) => void;
  /** Use vertical list layout (Notion-style) instead of grid */
  variant?: "grid" | "list";
  className?: string;
}

// Capability IDs marked as "new" - shown with blue badge
const NEW_CAPABILITY_IDS = new Set([
  "tool.detect-entities",
  "prompt.detect-entities",
  "tool.check-consistency",
]);

export function QuickActions({
  hasSelection,
  hasApiKey,
  onInvoke,
  variant = "list",
  className,
}: QuickActionsProps) {
  // Get capabilities for quick_actions surface
  const capabilities = useMemo(
    () => getCapabilitiesForSurface("quick_actions"),
    []
  );

  // Filter by selection and API key requirements
  const availableCapabilities = useMemo(
    () =>
      capabilities.filter((cap) => {
        // Check selection requirement
        if (cap.requiresSelection && !hasSelection) return false;
        // Check API key requirement
        if (cap.requiresApiKey && !hasApiKey) return false;
        return true;
      }),
    [capabilities, hasSelection, hasApiKey]
  );

  if (variant === "grid") {
    // Original grid layout (for docked sidebar)
    return (
      <div className={cn("px-3 py-2", className)}>
        <div className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2">
          Quick Actions
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {availableCapabilities.map((capability) => {
            const Icon = getCapabilityIcon(capability.icon);
            const isNew = NEW_CAPABILITY_IDS.has(capability.id);
            return (
              <button
                key={capability.id}
                onClick={() => onInvoke(capability)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-lg text-left",
                  "bg-mythos-bg-tertiary/50 hover:bg-mythos-bg-tertiary",
                  "text-xs text-mythos-text-secondary hover:text-mythos-text-primary",
                  "transition-colors border border-mythos-text-muted/10"
                )}
              >
                <Icon className="w-3.5 h-3.5 text-mythos-text-secondary shrink-0" />
                <span className="truncate flex-1">{capability.label}</span>
                {isNew && (
                  <span
                    className="px-1.5 py-0.5 text-[9px] font-medium rounded text-white"
                    style={{ background: accent.primary }}
                  >
                    New
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Notion-style vertical list layout (for floating chat)
  return (
    <div className={cn("space-y-0.5", className)}>
      {availableCapabilities.map((capability) => {
        const Icon = getCapabilityIcon(capability.icon);
        const isNew = NEW_CAPABILITY_IDS.has(capability.id);
        return (
          <button
            key={capability.id}
            onClick={() => onInvoke(capability)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left",
              "hover:bg-[rgba(255,255,255,0.04)] transition-colors group"
            )}
          >
            <div
              className="p-1.5 rounded-md transition-colors"
              style={{
                background: border.subtle,
                color: text.secondary
              }}
            >
              <Icon className="w-4 h-4 transition-colors" style={{ color: "inherit" }} />
            </div>
            <span
              className="text-[14px] transition-colors flex-1 group-hover:text-[#E3E2E0]"
              style={{ color: text.secondary }}
            >
              {capability.label}
            </span>
            {isNew && (
              <span
                className="px-2 py-0.5 text-[11px] font-medium rounded text-white"
                style={{ background: accent.primary }}
              >
                New
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
