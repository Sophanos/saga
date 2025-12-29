/**
 * Severity configuration for linter issues
 *
 * Provides UI configuration for severity levels including icon names,
 * colors, and labels. Icons are specified as string names (not React components)
 * so this can be used in the core package without React dependencies.
 */

/**
 * Severity levels for linter issues
 */
export type Severity = "error" | "warning" | "info";

/**
 * Issue types for linter issues
 */
export type LinterIssueType = "character" | "world" | "plot" | "timeline";

/**
 * Icon names that map to lucide-react icons
 */
export type SeverityIconName = "AlertCircle" | "AlertTriangle" | "Info";
export type IssueTypeIconName = "User" | "Globe" | "GitBranch" | "Clock";

/**
 * Configuration for a single severity level
 */
export interface SeverityConfig {
  /** Icon name from lucide-react */
  icon: SeverityIconName;
  /** Human-readable label */
  label: string;
  /** Tailwind CSS background class */
  bgClass: string;
  /** Tailwind CSS text color class */
  textClass: string;
  /** Tailwind CSS border class */
  borderClass: string;
  /** Tailwind CSS badge background class */
  badgeBg: string;
  /** Sort order (lower = higher priority) */
  order: number;
}

/**
 * Complete configuration for all severity levels
 */
export const SEVERITY_CONFIG: Record<Severity, SeverityConfig> = {
  error: {
    icon: "AlertCircle",
    label: "Error",
    bgClass: "bg-mythos-accent-red/10",
    textClass: "text-mythos-accent-red",
    borderClass: "border-mythos-accent-red/30",
    badgeBg: "bg-mythos-accent-red/20",
    order: 0,
  },
  warning: {
    icon: "AlertTriangle",
    label: "Warning",
    bgClass: "bg-mythos-accent-amber/10",
    textClass: "text-mythos-accent-amber",
    borderClass: "border-mythos-accent-amber/30",
    badgeBg: "bg-mythos-accent-amber/20",
    order: 1,
  },
  info: {
    icon: "Info",
    label: "Info",
    bgClass: "bg-mythos-accent-cyan/10",
    textClass: "text-mythos-accent-cyan",
    borderClass: "border-mythos-accent-cyan/30",
    badgeBg: "bg-mythos-accent-cyan/20",
    order: 2,
  },
};

/**
 * Configuration for issue types
 */
export interface IssueTypeConfig {
  /** Icon name from lucide-react */
  icon: IssueTypeIconName;
  /** Human-readable label */
  label: string;
  /** Tailwind CSS background class */
  bgClass: string;
  /** Tailwind CSS text color class */
  textClass: string;
}

/**
 * Complete configuration for all issue types
 */
export const ISSUE_TYPE_CONFIG: Record<LinterIssueType, IssueTypeConfig> = {
  character: {
    icon: "User",
    label: "Character",
    bgClass: "bg-mythos-accent-purple/20",
    textClass: "text-mythos-accent-purple",
  },
  world: {
    icon: "Globe",
    label: "World",
    bgClass: "bg-mythos-accent-green/20",
    textClass: "text-mythos-accent-green",
  },
  plot: {
    icon: "GitBranch",
    label: "Plot",
    bgClass: "bg-mythos-accent-pink/20",
    textClass: "text-mythos-accent-pink",
  },
  timeline: {
    icon: "Clock",
    label: "Timeline",
    bgClass: "bg-mythos-accent-orange/20",
    textClass: "text-mythos-accent-orange",
  },
};

/**
 * All severity levels in display order
 */
export const SEVERITIES: Severity[] = ["error", "warning", "info"];

/**
 * Get the configuration for a severity level
 * @param severity - The severity level
 * @returns Configuration object
 */
export function getSeverityConfig(severity: Severity): SeverityConfig {
  return SEVERITY_CONFIG[severity];
}

/**
 * Get the color class for a severity level
 * @param severity - The severity level
 * @returns Tailwind CSS text color class
 */
export function getSeverityColor(severity: Severity): string {
  return SEVERITY_CONFIG[severity]?.textClass ?? "text-mythos-text-muted";
}

/**
 * Get the human-readable label for a severity level
 * @param severity - The severity level
 * @returns Human-readable label
 */
export function getSeverityLabel(severity: Severity): string {
  return SEVERITY_CONFIG[severity]?.label ?? severity;
}

/**
 * Get the icon name for a severity level
 * @param severity - The severity level
 * @returns Icon name from lucide-react
 */
export function getSeverityIcon(severity: Severity): SeverityIconName {
  return SEVERITY_CONFIG[severity]?.icon ?? "Info";
}

/**
 * Get the configuration for an issue type
 * @param type - The issue type
 * @returns Configuration object
 */
export function getIssueTypeConfig(type: LinterIssueType): IssueTypeConfig {
  return ISSUE_TYPE_CONFIG[type];
}

/**
 * Get the human-readable label for an issue type
 * @param type - The issue type
 * @returns Human-readable label
 */
export function getIssueTypeLabel(type: LinterIssueType): string {
  return ISSUE_TYPE_CONFIG[type]?.label ?? type;
}
