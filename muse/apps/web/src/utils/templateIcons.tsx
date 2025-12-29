/**
 * Template Icon Registry
 *
 * This module provides a registry of Lucide icons used in project templates.
 * Instead of importing all ~200KB of lucide-react with a wildcard import,
 * we import only the specific icons needed for templates.
 */

import type { LucideIcon } from "lucide-react";
import {
  // Template icons
  Sword,
  Wand2,
  Dice5,
  Zap,
  BookOpen,
  Rocket,
  Skull,
  Heart,
  Search,
  Clapperboard,
  TrendingUp,
  GitBranch,
  LayoutGrid,
  File,
  // Entity icons
  User,
  MapPin,
  Gem,
  Users,
  Calendar,
  Lightbulb,
  Sparkles,
  Eye,
  Languages,
  Landmark,
  Crown,
  Sun,
  Bug,
  FlaskConical,
  UserCheck,
  Scroll,
  Swords,
  Flame,
  Compass,
  Feather,
  Scale,
  Cpu,
  Dna,
  Globe2,
  Ghost,
  AlertTriangle,
  UserX,
  AlertOctagon,
  Music,
  Film,
  Sparkle,
  Split,
  Flag,
  // Document icons
  List,
  StickyNote,
  Globe,
  Square,
  FileImage,
  Layers,
  Book,
  // Fallback
  FileText,
} from "lucide-react";

/**
 * Registry mapping icon names to their Lucide components.
 * Only includes icons used in project templates.
 */
const TEMPLATE_ICON_REGISTRY: Record<string, LucideIcon> = {
  // Template icons
  Sword,
  Wand2,
  Dice5,
  Zap,
  BookOpen,
  Rocket,
  Skull,
  Heart,
  Search,
  Clapperboard,
  TrendingUp,
  GitBranch,
  LayoutGrid,
  File,
  // Entity icons
  User,
  MapPin,
  Gem,
  Users,
  Calendar,
  Lightbulb,
  Sparkles,
  Eye,
  Languages,
  Landmark,
  Crown,
  Sun,
  Bug,
  FlaskConical,
  UserCheck,
  Scroll,
  Swords,
  Flame,
  Compass,
  Feather,
  Scale,
  Cpu,
  Dna,
  Globe2,
  Ghost,
  AlertTriangle,
  UserX,
  AlertOctagon,
  Music,
  Film,
  Sparkle,
  Split,
  Flag,
  // Document icons
  List,
  StickyNote,
  Globe,
  Square,
  FileImage,
  Layers,
  Book,
  // Fallback
  FileText,
};

/**
 * Get a template icon by name with optional className override.
 *
 * @param iconName - The name of the Lucide icon (e.g., "Sword", "Heart")
 * @param className - Optional CSS class (defaults to "w-5 h-5")
 * @returns React node rendering the icon, or FileText as fallback
 */
export function getTemplateIcon(
  iconName: string,
  className = "w-5 h-5"
): React.ReactNode {
  const Icon = TEMPLATE_ICON_REGISTRY[iconName];
  if (Icon) {
    return <Icon className={className} />;
  }
  // Fallback to FileText if icon not found
  return <FileText className={className} />;
}
