import type { JungianArchetype } from "../entities/types";

// Campbell's Hero's Journey stages
export type HerosJourneyStage =
  | "ordinary_world"
  | "call_to_adventure"
  | "refusal_of_call"
  | "meeting_mentor"
  | "crossing_threshold"
  | "tests_allies_enemies"
  | "approach_innermost_cave"
  | "ordeal"
  | "reward"
  | "road_back"
  | "resurrection"
  | "return_with_elixir";

// Dan Harmon's Story Circle stages
export type StoryCircleStage =
  | "you" // Comfort zone
  | "need" // Want something
  | "go" // Enter unfamiliar
  | "search" // Adapt to it
  | "find" // Get what they wanted
  | "take" // Pay a heavy price
  | "return" // Back to familiar
  | "change"; // Now capable of change

// Save the Cat beats
export type SaveTheCatBeat =
  | "opening_image"
  | "theme_stated"
  | "setup"
  | "catalyst"
  | "debate"
  | "break_into_two"
  | "b_story"
  | "fun_and_games"
  | "midpoint"
  | "bad_guys_close_in"
  | "all_is_lost"
  | "dark_night_of_soul"
  | "break_into_three"
  | "finale"
  | "final_image";

// Generic beat type
export type NarrativeBeat =
  | HerosJourneyStage
  | StoryCircleStage
  | SaveTheCatBeat
  | string;

// Scene structure
export interface Scene {
  id: string;
  documentId: string;
  title?: string;
  summary?: string;
  beat?: NarrativeBeat;
  tensionLevel: number; // 0-10
  pov?: string; // Character ID
  location?: string; // Location ID
  presentCharacters: string[]; // Character IDs
  wordCount: number;
  startPosition: number;
  endPosition: number;
}

// Chapter structure
export interface Chapter {
  id: string;
  documentId: string;
  number: number;
  title?: string;
  scenes: Scene[];
  wordCount: number;
  tensionArc: number[]; // Array of tension levels
  cliffhangerStrength?: number; // 0-10
}

// Arc structure
export interface Arc {
  id: string;
  name: string;
  type: "main" | "subplot" | "character";
  relatedCharacter?: string; // For character arcs
  stages: {
    beat: NarrativeBeat;
    chapterId?: string;
    sceneId?: string;
    completed: boolean;
  }[];
  startChapter?: number;
  endChapter?: number;
}

// Plot thread
export interface PlotThread {
  id: string;
  name: string;
  description?: string;
  status: "setup" | "active" | "dormant" | "resolved" | "abandoned";
  introducedIn: string; // Scene ID
  resolvedIn?: string; // Scene ID
  relatedEntities: string[];
  color?: string; // For visualization
}

// Foreshadowing tracker
export interface Foreshadowing {
  id: string;
  setup: {
    sceneId: string;
    text: string;
    position: number;
  };
  payoff?: {
    sceneId: string;
    text: string;
    position: number;
  };
  description: string;
  status: "planted" | "reinforced" | "paid_off" | "forgotten";
}

// Character arc tracking
export interface CharacterArc {
  characterId: string;
  archetype: JungianArchetype;
  startingState: string;
  desiredEndState: string;
  currentState?: string;
  transformationPoints: {
    sceneId: string;
    description: string;
    type: "growth" | "setback" | "revelation" | "decision";
  }[];
  shadowTraits: string[];
  hasIntegratedShadow: boolean;
}

// Pacing analysis
export interface PacingAnalysis {
  chapterId: string;
  averageTension: number;
  tensionVariance: number;
  actionSceneRatio: number;
  dialogueRatio: number;
  descriptionRatio: number;
  pacingScore: number; // 0-100
  issues: {
    type: "flat" | "too_intense" | "abrupt_shift";
    position: number;
    message: string;
  }[];
}

// Cliffhanger analysis
export interface CliffhangerAnalysis {
  chapterId: string;
  strength: number; // 0-10
  type:
    | "question"
    | "revelation"
    | "danger"
    | "decision"
    | "arrival"
    | "disappearance"
    | "none";
  predictedReaderReaction: string;
  suggestions?: string[];
}
