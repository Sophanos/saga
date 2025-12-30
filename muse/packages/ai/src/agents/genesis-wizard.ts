import { generateText } from "ai";
import { getModel } from "../providers";
import { GENESIS_SYSTEM } from "../prompts/genesis";
import type { ProjectConfig, Genre } from "@mythos/core";

export interface GenesisInput {
  prompt: string;
  existingContent?: string;
  preferences?: {
    tone?: "dark" | "light" | "mixed";
    length?: "short" | "medium" | "long";
  };
}

export interface SuggestedEntity {
  type: "character";
  role: "protagonist" | "antagonist" | "mentor" | "ally";
  suggestedArchetype: string;
  description: string;
}

export interface GenesisResult {
  analysis: {
    primaryGenre: string;
    subGenres: string[];
    tone: "dark" | "light" | "mixed";
    themes: string[];
  };
  projectConfig: Partial<ProjectConfig>;
  suggestedEntities: SuggestedEntity[];
  worldBuildingPrompts: string[];
  narrativeHooks: string[];
}

export async function runGenesis(input: GenesisInput): Promise<GenesisResult> {
  const userMessage = buildGenesisPrompt(input);

  const result = await generateText({
    model: getModel("analysis"),
    system: GENESIS_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    temperature: 0.7,
    maxOutputTokens: 4096,
  });

  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as GenesisResult;
    }
  } catch {
    console.error("Failed to parse Genesis response:", result.text);
  }

  // Return default structure if parsing fails
  return {
    analysis: {
      primaryGenre: "fantasy",
      subGenres: [],
      tone: "mixed",
      themes: [],
    },
    projectConfig: {},
    suggestedEntities: [],
    worldBuildingPrompts: [],
    narrativeHooks: [],
  };
}

function buildGenesisPrompt(input: GenesisInput): string {
  let prompt = `Create a story project scaffold based on this description:\n\n"${input.prompt}"`;

  if (input.existingContent) {
    prompt += `\n\nExisting content to consider:\n${input.existingContent}`;
  }

  if (input.preferences) {
    prompt += `\n\nUser preferences:`;
    if (input.preferences.tone) {
      prompt += `\n- Preferred tone: ${input.preferences.tone}`;
    }
    if (input.preferences.length) {
      prompt += `\n- Intended length: ${input.preferences.length}`;
    }
  }

  return prompt;
}

// Quick genre detection (without full Genesis)
export async function detectGenre(
  prompt: string
): Promise<{ genre: Genre; confidence: number }> {
  const result = await generateText({
    model: getModel("fast"),
    system: `You are a genre classifier. Given a story description, identify the primary genre.
Return JSON: { "genre": "genre_enum", "confidence": 0.0-1.0 }
Valid genres: high_fantasy, urban_fantasy, science_fiction, horror, mystery, romance, thriller, literary, manga_shounen, manga_seinen, manga_shoujo, manga_josei, litrpg, progression_fantasy, grimdark, slice_of_life`,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    maxOutputTokens: 100,
  });

  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Default fallback
  }

  return { genre: "high_fantasy" as Genre, confidence: 0.5 };
}
