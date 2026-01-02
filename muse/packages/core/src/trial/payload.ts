export const TRIAL_PAYLOAD_KEY = "mythos_trial_payload";
export const TRIAL_DRAFT_KEY = "mythos_trial_draft";

export type TryGoal =
  | "import_organize"
  | "proofread"
  | "world_bible"
  | "consistency_check"
  | "name_generator"
  | "visualize_characters";

export type GuardrailMode =
  | "no_plot_generation"
  | "suggestions_only"
  | "allow_generation";

export interface WriterPersonalizationV1 {
  genre?: string;
  projectType?: "novel" | "series" | "screenplay" | "game" | "world_bible" | "manga";
  trackEntityTypes?: Array<"character" | "location" | "item" | "faction" | "rule" | "timeline">;
  guardrails?: {
    plot: GuardrailMode;
    edits: "proofread_only" | "line_edits" | "rewrite";
    strictness: "low" | "medium" | "high";
    no_judgement_mode?: boolean;
  };
  styleMode?: "manga" | "prose";
}

export interface TrialUploadRef {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export interface MythosTrialPayloadV1 {
  v: 1;
  source: "paste" | "file";
  goal: TryGoal;
  tone: "safe" | "creative";
  text?: string;
  uploadRefs?: TrialUploadRef[];
  personalization?: WriterPersonalizationV1;
}
