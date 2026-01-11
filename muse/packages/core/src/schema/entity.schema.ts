import { z } from "zod";
import { graphEntitySchema, graphRelationshipSchema } from "./graph.schema";

// Enums as Zod schemas
export const entityTypeSchema = z.enum([
  "character",
  "location",
  "item",
  "magic_system",
  "faction",
  "event",
  "concept",
]);

export const jungianArchetypeSchema = z.enum([
  "hero",
  "mentor",
  "threshold_guardian",
  "herald",
  "shapeshifter",
  "shadow",
  "ally",
  "trickster",
  "mother",
  "father",
  "child",
  "maiden",
  "wise_old_man",
  "wise_old_woman",
  "anima",
  "animus",
]);

export const relationTypeSchema = z.enum([
  "knows",
  "loves",
  "hates",
  "killed",
  "created",
  "owns",
  "guards",
  "weakness",
  "strength",
  "parent_of",
  "child_of",
  "sibling_of",
  "married_to",
  "allied_with",
  "enemy_of",
  "member_of",
  "rules",
  "serves",
]);

// Visual Description
export const visualDescriptionSchema = z.object({
  height: z.string().optional(),
  build: z.string().optional(),
  hairColor: z.string().optional(),
  hairStyle: z.string().optional(),
  eyeColor: z.string().optional(),
  skinTone: z.string().optional(),
  distinguishingFeatures: z.array(z.string()).optional(),
  clothing: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  artStyle: z.string().optional(),
});

// Character Status
export const characterStatusSchema = z.object({
  health: z
    .enum(["healthy", "injured", "critical", "dead", "unknown"])
    .optional(),
  mood: z.string().optional(),
  location: z.string().optional(),
  activeQuest: z.string().optional(),
  powerLevel: z.number().optional(),
});

// Trait
export const traitSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["strength", "weakness", "neutral", "shadow"]),
  description: z.string().optional(),
  isHidden: z.boolean().optional(),
});

// Base Entity
export const entitySchema = graphEntitySchema.extend({
  type: entityTypeSchema,
});

// Character Entity
export const characterSchema = entitySchema.extend({
  type: z.literal("character"),
  archetype: jungianArchetypeSchema.optional(),
  traits: z.array(traitSchema).default([]),
  status: characterStatusSchema.default({}),
  visualDescription: visualDescriptionSchema.default({}),
  backstory: z.string().optional(),
  goals: z.array(z.string()).optional(),
  fears: z.array(z.string()).optional(),
  voiceNotes: z.string().optional(),
});

// Location Entity
export const locationSchema = entitySchema.extend({
  type: z.literal("location"),
  parentLocation: z.string().optional(),
  climate: z.string().optional(),
  atmosphere: z.string().optional(),
  inhabitants: z.array(z.string()).optional(),
  connectedTo: z.array(z.string()).optional(),
});

// Item Entity
export const itemSchema = entitySchema.extend({
  type: z.literal("item"),
  category: z.enum([
    "weapon",
    "armor",
    "artifact",
    "consumable",
    "key",
    "other",
  ]),
  rarity: z
    .enum(["common", "uncommon", "rare", "legendary", "unique"])
    .optional(),
  owner: z.string().optional(),
  location: z.string().optional(),
  abilities: z.array(z.string()).optional(),
});

// Magic System Entity
export const magicSystemSchema = entitySchema.extend({
  type: z.literal("magic_system"),
  rules: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  costs: z.array(z.string()).optional(),
  users: z.array(z.string()).optional(),
  spells: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        cost: z.string().optional(),
        requirements: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

// Faction Entity
export const factionSchema = entitySchema.extend({
  type: z.literal("faction"),
  leader: z.string().optional(),
  members: z.array(z.string()).optional(),
  headquarters: z.string().optional(),
  goals: z.array(z.string()).optional(),
  rivals: z.array(z.string()).optional(),
  allies: z.array(z.string()).optional(),
});

// Relationship
export const relationshipSchema = graphRelationshipSchema.extend({
  type: relationTypeSchema,
});

// Create entity schemas (for new entities)
export const createCharacterSchema = characterSchema.omit({
  id: true,
  mentions: true,
  createdAt: true,
  updatedAt: true,
});

export const createLocationSchema = locationSchema.omit({
  id: true,
  mentions: true,
  createdAt: true,
  updatedAt: true,
});

export const createItemSchema = itemSchema.omit({
  id: true,
  mentions: true,
  createdAt: true,
  updatedAt: true,
});
