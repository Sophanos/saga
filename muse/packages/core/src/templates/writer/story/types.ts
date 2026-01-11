import type { JungianArchetype } from "../../../entities/types";

export type HerosJourneyStage =
  | "ordinary_world"
  | "call_to_adventure"
  | "refusal_of_the_call"
  | "meeting_the_mentor"
  | "crossing_the_threshold"
  | "tests_allies_enemies"
  | "approach"
  | "ordeal"
  | "reward"
  | "the_road_back"
  | "resurrection"
  | "return_with_elixir";

export type StoryCircleStage =
  | "you"
  | "need"
  | "go"
  | "search"
  | "find"
  | "take"
  | "return"
  | "change";

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
  | "dark_night_of_the_soul"
  | "break_into_three"
  | "finale"
  | "final_image";

export type NarrativeBeat = {
  stage: HerosJourneyStage | StoryCircleStage | SaveTheCatBeat;
  description?: string;
  characters?: string[];
  archetypes?: JungianArchetype[];
  location?: string;
  tension?: number;
  themes?: string[];
};
