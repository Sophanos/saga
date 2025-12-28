import { User, MapPin, Sword, Sparkles, Users, Zap } from "lucide-react";
import type { Entity, EntityType } from "@mythos/core";

interface EntityAvatarProps {
  entity: Entity;
  onClick?: (entity: Entity) => void;
  size?: "sm" | "md" | "lg";
}

/**
 * Get the appropriate icon component for an entity type
 */
function getEntityIcon(type: EntityType) {
  switch (type) {
    case "character":
      return User;
    case "location":
      return MapPin;
    case "item":
      return Sword;
    case "magic_system":
      return Zap;
    case "faction":
      return Users;
    default:
      return Sparkles;
  }
}

/**
 * Get the color classes for an entity type
 */
function getEntityColorClasses(type: EntityType) {
  switch (type) {
    case "character":
      return {
        bg: "bg-mythos-entity-character/20",
        text: "text-mythos-entity-character",
        border: "border-mythos-entity-character/30",
        hover: "hover:bg-mythos-entity-character/30",
      };
    case "location":
      return {
        bg: "bg-mythos-entity-location/20",
        text: "text-mythos-entity-location",
        border: "border-mythos-entity-location/30",
        hover: "hover:bg-mythos-entity-location/30",
      };
    case "item":
      return {
        bg: "bg-mythos-entity-item/20",
        text: "text-mythos-entity-item",
        border: "border-mythos-entity-item/30",
        hover: "hover:bg-mythos-entity-item/30",
      };
    case "magic_system":
      return {
        bg: "bg-mythos-entity-magic/20",
        text: "text-mythos-entity-magic",
        border: "border-mythos-entity-magic/30",
        hover: "hover:bg-mythos-entity-magic/30",
      };
    case "faction":
      return {
        bg: "bg-mythos-accent-purple/20",
        text: "text-mythos-accent-purple",
        border: "border-mythos-accent-purple/30",
        hover: "hover:bg-mythos-accent-purple/30",
      };
    default:
      return {
        bg: "bg-mythos-accent-cyan/20",
        text: "text-mythos-accent-cyan",
        border: "border-mythos-accent-cyan/30",
        hover: "hover:bg-mythos-accent-cyan/30",
      };
  }
}

/**
 * Get size classes based on the size prop
 */
function getSizeClasses(size: "sm" | "md" | "lg") {
  switch (size) {
    case "sm":
      return {
        container: "w-6 h-6",
        icon: "w-3 h-3",
      };
    case "md":
      return {
        container: "w-8 h-8",
        icon: "w-4 h-4",
      };
    case "lg":
      return {
        container: "w-10 h-10",
        icon: "w-5 h-5",
      };
  }
}

/**
 * EntityAvatar - A small avatar component for entities
 *
 * Shows an icon based on entity type with color coding.
 * Displays entity name on hover via tooltip.
 * Triggers click handler to open HUD when clicked.
 */
export function EntityAvatar({ entity, onClick, size = "md" }: EntityAvatarProps) {
  const Icon = getEntityIcon(entity.type);
  const colors = getEntityColorClasses(entity.type);
  const sizeClasses = getSizeClasses(size);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(entity);
  };

  return (
    <button
      onClick={handleClick}
      className={`
        ${sizeClasses.container}
        ${colors.bg}
        ${colors.border}
        ${colors.hover}
        rounded-full
        border
        flex items-center justify-center
        cursor-pointer
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-mythos-accent-cyan/50
        group relative
      `}
      title={entity.name}
      aria-label={`View ${entity.name} (${entity.type})`}
    >
      <Icon className={`${sizeClasses.icon} ${colors.text}`} />

      {/* Tooltip - positioned above the avatar */}
      <div
        className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          px-2 py-1
          bg-mythos-bg-tertiary
          text-mythos-text-primary text-xs
          rounded
          border border-mythos-text-muted/20
          whitespace-nowrap
          opacity-0 group-hover:opacity-100
          pointer-events-none
          transition-opacity duration-150
          z-10
          shadow-lg
        "
      >
        {entity.name}
        <span className="text-mythos-text-muted ml-1 capitalize">
          ({entity.type.replace("_", " ")})
        </span>
        {/* Tooltip arrow */}
        <div
          className="
            absolute top-full left-1/2 -translate-x-1/2
            border-4 border-transparent border-t-mythos-bg-tertiary
          "
        />
      </div>
    </button>
  );
}
