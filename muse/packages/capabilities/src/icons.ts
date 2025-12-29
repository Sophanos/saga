/**
 * Icon mapping for capabilities.
 *
 * Maps string icon names (used in the capability registry) to Lucide icon components.
 * This is the single source of truth for capability icons across the application.
 */

import {
  AlertTriangle,
  BookOpen,
  Brain,
  Eye,
  GitBranch,
  Globe,
  LayoutTemplate,
  Lightbulb,
  MessageSquare,
  ScanSearch,
  Scale,
  Sparkles,
  User,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Map of icon names to Lucide icon components.
 * Used to resolve string-based icon names from the capability registry.
 */
export const CAPABILITY_ICON_MAP: Readonly<Record<string, LucideIcon>> = Object.freeze({
  AlertTriangle,
  BookOpen,
  Brain,
  Eye,
  GitBranch,
  Globe,
  LayoutTemplate,
  Lightbulb,
  MessageSquare,
  ScanSearch,
  Scale,
  Sparkles,
  User,
  Wand2,
  Zap,
});

/**
 * Get a Lucide icon component by name, with a fallback.
 * @param iconName - The name of the icon from the capability registry
 * @param fallback - Fallback icon if the name is not found (defaults to Sparkles)
 */
export function getCapabilityIcon(
  iconName: string,
  fallback: LucideIcon = Sparkles
): LucideIcon {
  return CAPABILITY_ICON_MAP[iconName] ?? fallback;
}

/** Re-export LucideIcon type for convenience */
export type { LucideIcon };
