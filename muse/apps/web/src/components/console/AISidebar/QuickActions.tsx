import { useMemo } from "react";
import {
  Sparkles,
  User,
  GitBranch,
  AlertTriangle,
  BookOpen,
  Lightbulb,
  ScanSearch,
  LayoutTemplate,
  Eye,
  Scale,
  Wand2,
  MessageSquare,
  Brain,
  Zap,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mythos/ui";
import {
  getCapabilitiesForSurface,
  type Capability,
} from "@mythos/capabilities";

// Icon mapping from string names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  User,
  GitBranch,
  AlertTriangle,
  BookOpen,
  Lightbulb,
  ScanSearch,
  LayoutTemplate,
  Eye,
  Scale,
  Wand2,
  MessageSquare,
  Brain,
  Zap,
  Globe,
};

interface QuickActionsProps {
  hasSelection: boolean;
  onInvoke: (capability: Capability) => void;
  className?: string;
}

export function QuickActions({
  hasSelection,
  onInvoke,
  className,
}: QuickActionsProps) {
  // Get capabilities for quick_actions surface
  const capabilities = useMemo(
    () => getCapabilitiesForSurface("quick_actions"),
    []
  );

  // Filter by selection requirement
  const availableCapabilities = useMemo(
    () =>
      capabilities.filter(
        (cap) => !cap.requiresSelection || hasSelection
      ),
    [capabilities, hasSelection]
  );

  return (
    <div className={cn("px-3 py-2", className)}>
      <div className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2">
        Quick Actions
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {availableCapabilities.map((capability) => {
          const Icon = ICON_MAP[capability.icon] ?? Sparkles;
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
