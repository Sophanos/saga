/**
 * EntityFloatingCard - Compact floating card for entity quick preview
 *
 * Design: Matches ArtifactPanel's refined minimal aesthetic.
 * Shows entity avatar, name, type badge, key properties, and actions.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  User,
  MapPin,
  Sword,
  Zap,
  Users,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  Network,
  MessageSquare,
} from "lucide-react";
import { cn } from "@mythos/ui";
import { entity as entityColors, entityExtended } from "@mythos/theme";

// ============================================================================
// Types
// ============================================================================

export type EntityType =
  | "character"
  | "location"
  | "item"
  | "magic_system"
  | "faction"
  | "event"
  | "concept";

export interface EntityRelationship {
  id: string;
  targetId: string;
  targetName: string;
  targetType: EntityType;
  relationshipType: string;
}

export interface EntityMention {
  id: string;
  documentTitle: string;
  excerpt: string;
  timestamp: number;
}

export interface EntityData {
  id: string;
  name: string;
  type: EntityType;
  aliases?: string[];
  notes?: string;
  properties?: Record<string, string | number | boolean>;
  relationships?: EntityRelationship[];
  mentions?: EntityMention[];
}

export interface EntityFloatingCardProps {
  entity: EntityData;
  anchor: { x: number; y: number };
  onClose: () => void;
  onExpand?: (entity: EntityData) => void;
  onOpenGraph?: (entity: EntityData) => void;
  onEdit?: (entity: EntityData) => void;
}

// ============================================================================
// Entity Color Config
// ============================================================================

function getEntityColor(type: EntityType): string {
  const colorMap: Record<EntityType, string> = {
    character: entityColors.character,
    location: entityColors.location,
    item: entityColors.item,
    magic_system: entityColors.magic,
    faction: entityExtended.faction,
    event: entityExtended.event,
    concept: entityExtended.concept,
  };
  return colorMap[type] ?? "#64748b";
}

function getEntityIcon(type: EntityType) {
  const iconMap: Record<EntityType, typeof User> = {
    character: User,
    location: MapPin,
    item: Sword,
    magic_system: Zap,
    faction: Users,
    event: Sparkles,
    concept: Sparkles,
  };
  return iconMap[type] ?? Sparkles;
}

// ============================================================================
// Main Component
// ============================================================================

export function EntityFloatingCard({
  entity,
  anchor,
  onClose,
  onExpand,
  onOpenGraph,
  onEdit,
}: EntityFloatingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const entityColor = getEntityColor(entity.type);
  const EntityIcon = getEntityIcon(entity.type);
  const cardWidth = 300;

  // Calculate position
  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const padding = 12;

    let top = anchor.y + 8;
    let left = anchor.x - cardWidth / 2;

    if (left < padding) left = padding;
    if (left + cardWidth > window.innerWidth - padding) {
      left = window.innerWidth - cardWidth - padding;
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = anchor.y - rect.height - 8;
    }

    setPosition({ top, left });
  }, [anchor, cardWidth]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleExpand = useCallback(() => {
    onExpand?.(entity);
  }, [entity, onExpand]);

  const handleGraph = useCallback(() => {
    onOpenGraph?.(entity);
  }, [entity, onOpenGraph]);

  const handleEdit = useCallback(() => {
    onEdit?.(entity);
  }, [entity, onEdit]);

  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties).slice(0, 3);
  const relationshipCount = entity.relationships?.length ?? 0;
  const mentionCount = entity.mentions?.length ?? 0;

  return (
    <div
      ref={cardRef}
      className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: position.top,
        left: position.left,
        width: cardWidth,
      }}
    >
      <div
        className="rounded-xl border border-mythos-border-default bg-mythos-bg-secondary shadow-xl overflow-hidden"
        style={{
          boxShadow: `0 0 0 1px rgba(0,0,0,0.03), 0 8px 32px -8px rgba(0,0,0,0.4), 0 0 24px -8px ${entityColor}15`,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform hover:scale-105"
            style={{
              backgroundColor: `${entityColor}18`,
              border: `1px solid ${entityColor}30`,
            }}
          >
            <EntityIcon
              className="w-5 h-5"
              style={{ color: entityColor }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-mythos-text-primary truncate leading-tight">
              {entity.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-1.5 py-0.5 text-[10px] font-medium rounded capitalize"
                style={{
                  backgroundColor: `${entityColor}20`,
                  color: entityColor,
                }}
              >
                {entity.type.replace("_", " ")}
              </span>
              {entity.aliases && entity.aliases.length > 0 && (
                <span className="text-xs text-mythos-text-muted truncate">
                  aka {entity.aliases[0]}
                </span>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-mythos-bg-tertiary text-mythos-text-muted hover:text-mythos-text-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Properties */}
        {propertyEntries.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {propertyEntries.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-mythos-bg-tertiary border border-mythos-border-default/50"
              >
                <span className="text-mythos-text-muted capitalize">{key}</span>
                <span className="text-mythos-text-secondary font-medium">
                  {String(value)}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Stats bar */}
        {(relationshipCount > 0 || mentionCount > 0) && (
          <div className="px-4 pb-3 flex items-center gap-3 text-[11px] text-mythos-text-muted">
            {relationshipCount > 0 && (
              <span className="flex items-center gap-1">
                <Network className="w-3 h-3" />
                {relationshipCount} connection{relationshipCount !== 1 ? "s" : ""}
              </span>
            )}
            {mentionCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {mentionCount} mention{mentionCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-mythos-border-default" />

        {/* Actions */}
        <div className="flex p-1.5 gap-1">
          <button
            onClick={handleExpand}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium text-mythos-text-secondary hover:text-mythos-text-primary hover:bg-mythos-bg-tertiary transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Expand</span>
          </button>
          <button
            onClick={handleGraph}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium text-mythos-text-secondary hover:text-mythos-text-primary hover:bg-mythos-bg-tertiary transition-colors"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Graph</span>
          </button>
          <button
            onClick={handleEdit}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium text-mythos-text-secondary hover:text-mythos-text-primary hover:bg-mythos-bg-tertiary transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mock Data
// ============================================================================

export const MOCK_ELENA: EntityData = {
  id: "entity_elena",
  name: "Elena Blackwood",
  type: "character",
  aliases: ["The Shadow Walker", "Lady E"],
  notes:
    "A skilled tracker from the Northern Reaches. She carries a mysterious blade that glows in the presence of dark magic.",
  properties: {
    occupation: "Bounty Hunter",
    status: "Active",
    age: 28,
  },
  relationships: [
    {
      id: "rel_1",
      targetId: "marcus",
      targetName: "Marcus Thorne",
      targetType: "character",
      relationshipType: "ally",
    },
    {
      id: "rel_2",
      targetId: "shadowfell",
      targetName: "The Shadowfell",
      targetType: "location",
      relationshipType: "origin",
    },
    {
      id: "rel_3",
      targetId: "moonblade",
      targetName: "Moonblade",
      targetType: "item",
      relationshipType: "owns",
    },
  ],
  mentions: [
    {
      id: "m1",
      documentTitle: "Chapter 3: The Hunt Begins",
      excerpt: "Elena crouched in the shadows, her blade humming softly...",
      timestamp: Date.now() - 86400000,
    },
    {
      id: "m2",
      documentTitle: "Chapter 7: Revelations",
      excerpt:
        '"You don\'t understand," Elena said, her voice barely above a whisper...',
      timestamp: Date.now() - 172800000,
    },
  ],
};

export default EntityFloatingCard;
