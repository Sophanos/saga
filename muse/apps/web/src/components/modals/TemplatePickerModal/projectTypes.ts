/**
 * Re-export shared project types from @mythos/core
 * with platform-specific icon mappings for web (lucide-react)
 */

import type { LucideIcon } from "lucide-react";
import { BookOpen, Cpu, Film, Megaphone, Package, PenTool } from "lucide-react";
import {
  type ProjectType,
  type ProjectTypeDef as CoreProjectTypeDef,
  PROJECT_TYPE_DEFS as CORE_PROJECT_TYPE_DEFS,
} from "@mythos/core";

// Re-export all shared types and constants
export {
  type ProjectType,
  type TemplateBuilderPhase,
  type AccentKey,
  type Suggestion,
  type DomainQuestion,
  type ProjectTypeBlueprint,
  PROJECT_TYPE_ORDER,
  DOMAIN_SUGGESTIONS,
  DOMAIN_QUESTIONS,
  PROJECT_TYPE_BLUEPRINTS,
} from "@mythos/core";

// Web-specific: ProjectTypeDef with icon
export interface ProjectTypeDef extends CoreProjectTypeDef {
  icon: LucideIcon;
}

// Web-specific: Icon mapping for lucide-react
const PROJECT_TYPE_ICONS: Record<ProjectType, LucideIcon> = {
  story: BookOpen,
  product: Package,
  engineering: Cpu,
  design: PenTool,
  comms: Megaphone,
  cinema: Film,
};

// Web-specific: PROJECT_TYPE_DEFS with icons
export const PROJECT_TYPE_DEFS: Record<ProjectType, ProjectTypeDef> = Object.fromEntries(
  Object.entries(CORE_PROJECT_TYPE_DEFS).map(([key, def]) => [
    key,
    { ...def, icon: PROJECT_TYPE_ICONS[key as ProjectType] },
  ])
) as Record<ProjectType, ProjectTypeDef>;
