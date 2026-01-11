/**
 * Entity configuration utilities for web components
 *
 * This file maps the icon names from @mythos/core to actual Lucide React components.
 * Use these utilities instead of duplicating icon/color mappings in components.
 */
import {
  User,
  MapPin,
  Sword,
  Wand2,
  Building2,
  Calendar,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  type GraphEntityType,
  type WriterEntityType,
  type EntityIconName,
  WRITER_ENTITY_TYPE_CONFIG,
  WRITER_ENTITY_TYPES,
  WRITER_ENTITY_HEX_COLORS,
  getEntityIcon,
  getEntityLabel,
  getEntityHexColor,
} from "@mythos/core";

/**
 * Map of icon names to Lucide React components
 */
const ICON_COMPONENTS: Record<EntityIconName, LucideIcon> = {
  User,
  MapPin,
  Sword,
  Wand2,
  Building2,
  Calendar,
  Sparkles,
};

/**
 * Get the Lucide React icon component for an entity type
 * @param type - The entity type
 * @returns Lucide React icon component
 */
export function getEntityIconComponent(type: GraphEntityType): LucideIcon {
  const iconName = getEntityIcon(type);
  return ICON_COMPONENTS[iconName] ?? Sparkles;
}

/**
 * Get icon component by name (for direct icon name lookups)
 * @param name - The icon name from EntityIconName
 * @returns Lucide React icon component
 */
export function getIconByName(name: EntityIconName): LucideIcon {
  return ICON_COMPONENTS[name] ?? Sparkles;
}

/**
 * Entity type button configuration for UI controls
 * Combines type, icon component, label, and color
 */
export interface EntityTypeButtonConfig {
  type: WriterEntityType;
  icon: LucideIcon;
  label: string;
  color: string;
}

/**
 * Get all entity type button configs for filter controls
 * @returns Array of button configs with icon components
 */
export function getEntityTypeButtons(): EntityTypeButtonConfig[] {
  return WRITER_ENTITY_TYPES.map((type) => ({
    type,
    icon: getEntityIconComponent(type),
    label: WRITER_ENTITY_TYPE_CONFIG[type].label,
    color: WRITER_ENTITY_HEX_COLORS[type],
  }));
}

// Re-export core utilities for convenience
export {
  WRITER_ENTITY_TYPE_CONFIG,
  WRITER_ENTITY_TYPES,
  WRITER_ENTITY_HEX_COLORS,
  getEntityIcon,
  getEntityLabel,
  getEntityHexColor,
  type EntityIconName,
};
