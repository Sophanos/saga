import { useState, useCallback } from "react";
import {
  Settings2,
  User,
  Globe,
  GitBranch,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Check,
  RotateCcw,
} from "lucide-react";
import { Button, ScrollArea, Select, cn } from "@mythos/ui";

/**
 * Rule category configuration
 */
export interface RuleCategory {
  id: "character" | "world" | "plot" | "timeline";
  label: string;
  description: string;
  icon: typeof User;
  enabled: boolean;
}

/**
 * Severity override configuration
 */
export interface SeverityOverride {
  category: RuleCategory["id"];
  originalSeverity: "error" | "warning" | "info";
  overrideSeverity: "error" | "warning" | "info" | "disabled";
}

/**
 * Props for LinterRulesConfig component
 */
interface LinterRulesConfigProps {
  /** Current rule categories configuration */
  categories?: RuleCategory[];
  /** Current severity overrides */
  severityOverrides?: SeverityOverride[];
  /** Callback when a category is toggled */
  onCategoryToggle?: (categoryId: RuleCategory["id"], enabled: boolean) => void;
  /** Callback when a severity is overridden */
  onSeverityOverride?: (override: SeverityOverride) => void;
  /** Callback to reset all settings to default */
  onResetToDefaults?: () => void;
  /** Optional class name */
  className?: string;
}

/**
 * Default rule categories
 */
const defaultCategories: RuleCategory[] = [
  {
    id: "character",
    label: "Character Consistency",
    description: "Track character traits, names, relationships, and behaviors",
    icon: User,
    enabled: true,
  },
  {
    id: "world",
    label: "World Building",
    description: "Validate locations, settings, and environmental details",
    icon: Globe,
    enabled: true,
  },
  {
    id: "plot",
    label: "Plot Coherence",
    description: "Check story logic, cause-effect, and narrative flow",
    icon: GitBranch,
    enabled: true,
  },
  {
    id: "timeline",
    label: "Timeline Accuracy",
    description: "Verify chronological consistency and event ordering",
    icon: Clock,
    enabled: true,
  },
];

/**
 * Severity level configuration
 */
const severityLevels = [
  {
    id: "error" as const,
    label: "Error",
    icon: AlertCircle,
    textClass: "text-mythos-accent-red",
    bgClass: "bg-mythos-accent-red/10",
    description: "Critical issues that must be fixed",
  },
  {
    id: "warning" as const,
    label: "Warning",
    icon: AlertTriangle,
    textClass: "text-mythos-accent-amber",
    bgClass: "bg-mythos-accent-amber/10",
    description: "Potential problems to review",
  },
  {
    id: "info" as const,
    label: "Info",
    icon: Info,
    textClass: "text-mythos-accent-cyan",
    bgClass: "bg-mythos-accent-cyan/10",
    description: "Suggestions and style notes",
  },
  {
    id: "disabled" as const,
    label: "Disabled",
    icon: Check,
    textClass: "text-mythos-text-muted",
    bgClass: "bg-mythos-bg-tertiary",
    description: "Don't show these issues",
  },
];

/**
 * Toggle switch component
 */
function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-mythos-accent-cyan focus:ring-offset-2 focus:ring-offset-mythos-bg-primary",
        enabled ? "bg-mythos-accent-cyan" : "bg-mythos-text-muted/30",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

/**
 * Severity options for the Select component
 */
const severityOptions = [
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "disabled", label: "Disabled" },
];

/**
 * Category card component
 */
function CategoryCard({
  category,
  onToggle,
  isExpanded,
  onExpandToggle,
}: {
  category: RuleCategory;
  onToggle: (enabled: boolean) => void;
  isExpanded: boolean;
  onExpandToggle: () => void;
}) {
  const Icon = category.icon;

  // Track severity overrides for each level
  const [severityOverrides, setSeverityOverrides] = useState<
    Record<string, string>
  >({
    error: "error",
    warning: "warning",
    info: "info",
  });

  const handleSeverityChange = (levelId: string, newValue: string) => {
    setSeverityOverrides((prev) => ({
      ...prev,
      [levelId]: newValue,
    }));
  };

  return (
    <div
      className={cn(
        "rounded-md border transition-colors",
        category.enabled
          ? "border-mythos-text-muted/20 bg-mythos-bg-secondary/50"
          : "border-mythos-text-muted/10 bg-mythos-bg-tertiary/30 opacity-60"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Expand toggle */}
        <button
          type="button"
          onClick={onExpandToggle}
          className="p-0.5 rounded hover:bg-mythos-bg-tertiary text-mythos-text-muted hover:text-mythos-text-primary transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Icon */}
        <div
          className={cn(
            "w-8 h-8 rounded flex items-center justify-center",
            category.enabled
              ? "bg-mythos-accent-cyan/10 text-mythos-accent-cyan"
              : "bg-mythos-bg-tertiary text-mythos-text-muted"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        {/* Label and description */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-mythos-text-primary truncate">
            {category.label}
          </h4>
          <p className="text-xs text-mythos-text-muted truncate">
            {category.description}
          </p>
        </div>

        {/* Toggle */}
        <Toggle enabled={category.enabled} onChange={onToggle} />
      </div>

      {/* Expanded severity options */}
      {isExpanded && category.enabled && (
        <div className="px-3 pb-3 pt-0 border-t border-mythos-text-muted/10">
          <p className="text-[10px] uppercase tracking-wider text-mythos-text-muted mt-2 mb-2">
            Severity Levels
          </p>
          <div className="space-y-1.5">
            {severityLevels.slice(0, 3).map((level) => {
              const LevelIcon = level.icon;
              return (
                <div
                  key={level.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <LevelIcon className={cn("w-3 h-3", level.textClass)} />
                    <span className="text-mythos-text-secondary">
                      {level.label}
                    </span>
                  </div>
                  <Select
                    value={severityOverrides[level.id]}
                    onChange={(value) => handleSeverityChange(level.id, value)}
                    options={severityOptions}
                    className="h-6 w-24 text-[10px] px-1.5 py-0.5"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * LinterRulesConfig Component
 *
 * A configuration panel for managing linter rule categories and severity overrides.
 * Allows users to enable/disable specific rule categories and customize
 * how different severity levels are displayed.
 */
export function LinterRulesConfig({
  categories = defaultCategories,
  onCategoryToggle,
  onResetToDefaults,
  className,
}: LinterRulesConfigProps) {
  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // Local state for categories (can be controlled externally)
  const [localCategories, setLocalCategories] =
    useState<RuleCategory[]>(categories);

  // Toggle category expansion
  const toggleExpand = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Handle category toggle
  const handleCategoryToggle = useCallback(
    (categoryId: RuleCategory["id"], enabled: boolean) => {
      setLocalCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId ? { ...cat, enabled } : cat
        )
      );
      onCategoryToggle?.(categoryId, enabled);
    },
    [onCategoryToggle]
  );

  // Handle reset to defaults
  const handleReset = useCallback(() => {
    setLocalCategories(defaultCategories);
    setExpandedCategories(new Set());
    onResetToDefaults?.();
  }, [onResetToDefaults]);

  // Count enabled categories
  const enabledCount = localCategories.filter((c) => c.enabled).length;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-mythos-text-muted/20">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-mythos-text-muted" />
          <span className="text-sm font-medium text-mythos-text-primary">
            Rule Configuration
          </span>
          <span className="text-xs text-mythos-text-muted">
            ({enabledCount}/{localCategories.length} enabled)
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          className="h-7 text-xs text-mythos-text-muted hover:text-mythos-text-primary"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>

      {/* Categories list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {localCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onToggle={(enabled) => handleCategoryToggle(category.id, enabled)}
              isExpanded={expandedCategories.has(category.id)}
              onExpandToggle={() => toggleExpand(category.id)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer with info */}
      <div className="p-3 border-t border-mythos-text-muted/10">
        <p className="text-[10px] text-mythos-text-muted text-center">
          Changes apply to the next linting run
        </p>
      </div>
    </div>
  );
}

export default LinterRulesConfig;
