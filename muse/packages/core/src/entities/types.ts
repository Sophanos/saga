import type { z } from "zod";
import type {
  entitySchema,
  characterSchema,
  locationSchema,
  itemSchema,
  magicSystemSchema,
  factionSchema,
} from "../schema/entity.schema";

// Entity Types
export type EntityType =
  | "character"
  | "location"
  | "item"
  | "magic_system"
  | "faction"
  | "event"
  | "concept";

// Jungian Archetypes
export type JungianArchetype =
  | "hero"
  | "mentor"
  | "threshold_guardian"
  | "herald"
  | "shapeshifter"
  | "shadow"
  | "ally"
  | "trickster"
  | "mother"
  | "father"
  | "child"
  | "maiden"
  | "wise_old_man"
  | "wise_old_woman"
  | "anima"
  | "animus";

// Relationship Types
export type RelationType =
  | "knows"
  | "loves"
  | "hates"
  | "killed"
  | "created"
  | "owns"
  | "guards"
  | "weakness"
  | "strength"
  | "parent_of"
  | "child_of"
  | "sibling_of"
  | "married_to"
  | "allied_with"
  | "enemy_of"
  | "member_of"
  | "rules"
  | "serves";

// Property Value Types
export type PropertyValue =
  | string
  | number
  | boolean
  | string[]
  | { [key: string]: PropertyValue };

// Visual Description for Mangaka persona
export interface VisualDescription {
  height?: string;
  build?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  distinguishingFeatures?: string[];
  clothing?: string;
  accessories?: string[];
  artStyle?: string; // e.g., "shounen", "seinen", "josei"
}

// Character Status (for ASCII HUD)
export interface CharacterStatus {
  health?: "healthy" | "injured" | "critical" | "dead" | "unknown";
  mood?: string;
  location?: string;
  activeQuest?: string;
  powerLevel?: number;
}

// Trait for character complexity
export interface Trait {
  name: string;
  type: "strength" | "weakness" | "neutral" | "shadow";
  description?: string;
  isHidden?: boolean; // For shadow traits
}

// Mention tracking
export interface Mention {
  id: string;
  documentId: string;
  positionStart: number;
  positionEnd: number;
  context: string;
  timestamp: Date;
}

// Base Entity
export interface Entity {
  id: string;
  name: string;
  aliases: string[];
  type: EntityType;
  properties: Record<string, PropertyValue>;
  mentions: Mention[];
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

// Character Entity
export interface Character extends Entity {
  type: "character";
  archetype?: JungianArchetype;
  traits: Trait[];
  status: CharacterStatus;
  visualDescription: VisualDescription;
  backstory?: string;
  goals?: string[];
  fears?: string[];
  voiceNotes?: string; // How they speak
}

// Location Entity
export interface Location extends Entity {
  type: "location";
  parentLocation?: string; // ID of parent location
  climate?: string;
  atmosphere?: string;
  inhabitants?: string[]; // Character IDs
  connectedTo?: string[]; // Location IDs
}

// Item Entity
export interface Item extends Entity {
  type: "item";
  category: "weapon" | "armor" | "artifact" | "consumable" | "key" | "other";
  rarity?: "common" | "uncommon" | "rare" | "legendary" | "unique";
  owner?: string; // Character ID
  location?: string; // Location ID
  abilities?: string[];
}

// Magic System Entity
export interface MagicSystem extends Entity {
  type: "magic_system";
  rules: string[];
  limitations: string[];
  costs?: string[];
  users?: string[]; // Character IDs
  spells?: {
    name: string;
    description: string;
    cost?: string;
    requirements?: string[];
  }[];
}

// Faction Entity
export interface Faction extends Entity {
  type: "faction";
  leader?: string; // Character ID
  members?: string[]; // Character IDs
  headquarters?: string; // Location ID
  goals?: string[];
  rivals?: string[]; // Faction IDs
  allies?: string[]; // Faction IDs
}

// Relationship
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  bidirectional: boolean;
  strength?: number; // 1-10
  metadata?: Record<string, PropertyValue>;
  notes?: string;
  createdAt: Date;
}

// Inferred types from Zod schemas
export type EntitySchema = z.infer<typeof entitySchema>;
export type CharacterSchema = z.infer<typeof characterSchema>;
export type LocationSchema = z.infer<typeof locationSchema>;
export type ItemSchema = z.infer<typeof itemSchema>;
export type MagicSystemSchema = z.infer<typeof magicSystemSchema>;
export type FactionSchema = z.infer<typeof factionSchema>;
