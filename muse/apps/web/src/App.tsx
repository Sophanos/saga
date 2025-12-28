import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { useMythosStore } from "./stores";
import type { Character, Location, Item } from "@mythos/core";

// Demo entities matching the editor content
const demoEntities: (Character | Location | Item)[] = [
  // Valdris - ancient city with spires
  {
    id: "loc1",
    name: "Valdris",
    aliases: ["The Spired City", "City of Whispers"],
    type: "location",
    properties: {
      population: "~50,000",
      founded: "Third Age, Year 412",
      governmentType: "Council of Elders",
    },
    mentions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: "Ancient city known for its towering crystalline spires that catch the light at sunset. Home to the Council and the protagonist's destination.",
    climate: "Temperate, mild winters",
    atmosphere: "Ancient and mysterious, with narrow winding streets and buildings that seem to whisper secrets. The spires create an ever-changing play of light and shadow.",
    inhabitants: ["char2"],
    connectedTo: [],
  } as Location,

  // Kael - protagonist with the Blade
  {
    id: "char1",
    name: "Kael",
    aliases: ["The Blade-Bearer", "Wanderer"],
    type: "character",
    properties: {
      age: 28,
      occupation: "Former soldier, now reluctant hero",
      homeland: "The Northern Wastes",
    },
    mentions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: "Protagonist carrying a heavy burden. The Blade chose him, not the other way around.",
    archetype: "hero",
    traits: [
      { name: "Determined", type: "strength", description: "Will not stop until his mission is complete" },
      { name: "Burdened", type: "neutral", description: "Carries the weight of responsibility heavily" },
      { name: "Secretive", type: "shadow", description: "Keeps important information close", isHidden: true },
      { name: "Compassionate", type: "strength", description: "Despite his gruff exterior, cares deeply for others" },
    ],
    status: {
      health: "healthy",
      mood: "Tense, determined",
      location: "loc1",
      activeQuest: "Report to the Council",
      powerLevel: 7,
    },
    visualDescription: {
      height: "6'1\"",
      build: "Athletic, lean muscle from years of travel",
      hairColor: "Dark brown, almost black",
      hairStyle: "Shoulder-length, often windswept",
      eyeColor: "Storm gray",
      skinTone: "Weathered tan",
      distinguishingFeatures: ["Scar across left eyebrow", "Calloused hands"],
      clothing: "Worn leather cloak over practical traveling clothes",
      accessories: ["The Blade of Whispers at his hip", "Silver ring on right hand"],
      artStyle: "seinen",
    },
    backstory: "Once a soldier in the Northern Wars, Kael found the Blade of Whispers in the ruins of an ancient temple. Since then, the weapon has guided him on a path he never chose but cannot abandon.",
    goals: ["Deliver his discovery to the Council", "Understand the Blade's true purpose", "Find peace"],
    fears: ["Losing control to the Blade", "Failing those who depend on him"],
    voiceNotes: "Speaks tersely, economically. Rarely wastes words. When he does speak at length, people listen.",
  } as Character,

  // Master Theron - mentor figure
  {
    id: "char2",
    name: "Master Theron",
    aliases: ["The Old Shadow", "Keeper of Secrets"],
    type: "character",
    properties: {
      age: 67,
      occupation: "Council Advisor, former spymaster",
      yearsInValdris: 40,
    },
    mentions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: "Mentor figure with mysterious knowledge. His eyes suggest he knows more than he reveals.",
    archetype: "mentor",
    traits: [
      { name: "Wise", type: "strength", description: "Decades of experience inform his counsel" },
      { name: "Cryptic", type: "neutral", description: "Speaks in riddles and half-truths" },
      { name: "Manipulative", type: "shadow", description: "Not above using people for the greater good", isHidden: true },
      { name: "Patient", type: "strength", description: "Waits for the right moment to act" },
    ],
    status: {
      health: "healthy",
      mood: "Watchful, slightly amused",
      location: "loc1",
      activeQuest: "Guide the Blade-Bearer",
      powerLevel: 5,
    },
    visualDescription: {
      height: "5'9\"",
      build: "Thin but wiry, deceptively strong",
      hairColor: "Silver-white",
      hairStyle: "Long, pulled back in a simple tie",
      eyeColor: "Pale blue, almost luminescent",
      skinTone: "Pale, lined with age",
      distinguishingFeatures: ["Eyes that seem to gleam in shadows", "Moves silently"],
      clothing: "Dark robes that blend with shadows",
      accessories: ["Walking staff with hidden blade", "Ancient signet ring"],
      artStyle: "seinen",
    },
    backstory: "Master Theron has served Valdris for four decades, first as a spy during the Shadow Wars, then as an advisor to three generations of the Council. He knows secrets that could topple kingdoms.",
    goals: ["Prepare Kael for what's coming", "Protect Valdris", "Atone for past sins"],
    fears: ["The return of the Shadow", "His past catching up with him"],
    voiceNotes: "Speaks softly but with absolute authority. Often pauses mid-sentence, as if listening to something others cannot hear.",
  } as Character,

  // Blade of Whispers - sentient weapon
  {
    id: "item1",
    name: "Blade of Whispers",
    aliases: ["The Whispering Edge", "Soul-Drinker"],
    type: "item",
    properties: {
      material: "Unknown dark metal that absorbs light",
      length: "36 inches",
      forgedBy: "Unknown, predates recorded history",
    },
    mentions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: "A sentient weapon that chose Kael as its bearer. Its hum is audible only to him, and its whispers guide his path.",
    category: "weapon",
    rarity: "unique",
    owner: "char1",
    abilities: [
      "Whispers guidance to its wielder",
      "Hums in the presence of danger",
      "Cuts through magical barriers",
      "Absorbs the essence of the slain (rumored)",
    ],
  } as Item,
];

function App() {
  const addEntity = useMythosStore((state) => state.addEntity);
  const entities = useMythosStore((state) => state.world.entities);

  // Seed demo entities on mount
  useEffect(() => {
    // Only seed if entities are empty (prevent re-seeding on hot reload)
    if (entities.size === 0) {
      demoEntities.forEach((entity) => {
        addEntity(entity);
      });
    }
  }, [addEntity, entities.size]);

  return (
    <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased">
      <Layout />
    </div>
  );
}

export default App;
