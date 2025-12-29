import { useMemo } from "react";
import { cn } from "@mythos/ui";
import {
  getCapabilitiesForSurface,
  getCapabilityIcon,
  type Capability,
} from "@mythos/capabilities";

interface QuickActionsProps {
  hasSelection: boolean;
  hasApiKey: boolean;
  onInvoke: (capability: Capability) => void;
  className?: string;
}

export function QuickActions({
  hasSelection,
  hasApiKey,
  onInvoke,
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

  return (
    <div className={cn("px-3 py-2", className)}>
      <div className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2">
        Quick Actions
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {availableCapabilities.map((capability) => {
          const Icon = getCapabilityIcon(capability.icon);
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
              <Icon className="w-3.5 h-3.5 text-mythos-accent-purple shrink-0" />
              <span className="truncate">{capability.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
