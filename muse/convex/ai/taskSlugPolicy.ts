import type { AITaskSlug } from "../lib/providers/types";

export const INTERACTIVE_TASK_ALLOWLIST: readonly AITaskSlug[] = [
  "chat",
  "review",
  "generation",
  "thinking",
  "summarize",
] as const;

export const SPAWN_TASK_ALLOWLIST = {
  writing: ["generation", "review"],
  analysis: ["thinking", "review"],
  research: ["thinking", "review"],
} as const satisfies Record<string, readonly AITaskSlug[]>;

export const DEFAULT_SPAWN_TASK_SLUG = {
  writing: "generation",
  analysis: "thinking",
  research: "thinking",
} as const satisfies Record<string, AITaskSlug>;
