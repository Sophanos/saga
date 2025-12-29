import {
  User,
  MapPin,
  Sword,
  Wand2,
  Building2,
  Search,
} from "lucide-react";
import type { Command } from "./registry";

export const entityCommands: Command[] = [
  {
    id: "entity.create.character",
    label: "Create Character",
    description: "Create a new character entity",
    icon: User,
    category: "entity",
    keywords: ["new", "character", "person", "npc", "protagonist", "antagonist"],
    shortcut: "⌘⇧C",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.openModal({
        type: "entityForm",
        mode: "create",
        entityType: "character",
      });
    },
  },
  {
    id: "entity.create.location",
    label: "Create Location",
    description: "Create a new location or place",
    icon: MapPin,
    category: "entity",
    keywords: ["new", "location", "place", "setting", "world", "map"],
    shortcut: "⌘⇧O",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.openModal({
        type: "entityForm",
        mode: "create",
        entityType: "location",
      });
    },
  },
  {
    id: "entity.create.item",
    label: "Create Item",
    description: "Create a new item or artifact",
    icon: Sword,
    category: "entity",
    keywords: ["new", "item", "artifact", "weapon", "object", "thing"],
    shortcut: "⌘⇧I",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.openModal({
        type: "entityForm",
        mode: "create",
        entityType: "item",
      });
    },
  },
  {
    id: "entity.create.magic_system",
    label: "Create Magic System",
    description: "Define a new magic or power system",
    icon: Wand2,
    category: "entity",
    keywords: ["new", "magic", "system", "power", "ability", "supernatural"],
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.openModal({
        type: "entityForm",
        mode: "create",
        entityType: "magic_system",
      });
    },
  },
  {
    id: "entity.create.faction",
    label: "Create Faction",
    description: "Create a new faction or organization",
    icon: Building2,
    category: "entity",
    keywords: ["new", "faction", "organization", "group", "guild", "clan"],
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.openModal({
        type: "entityForm",
        mode: "create",
        entityType: "faction",
      });
    },
  },
  {
    id: "entity.search",
    label: "Search Entities",
    description: "Search through all entities in your world",
    icon: Search,
    category: "entity",
    keywords: ["find", "search", "entity", "lookup"],
    shortcut: "⌘E",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setActiveTab("search");
    },
  },
];
