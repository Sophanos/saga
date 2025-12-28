/**
 * Sensory balance analysis for writing coach
 * Tracks distribution of sensory details across the five senses
 */
export interface SensoryBalance {
  sight: number;
  sound: number;
  touch: number;
  smell: number;
  taste: number;
}

/**
 * Metrics for a scene's writing quality and dynamics
 */
export interface SceneMetrics {
  /** Tension level per paragraph (0-100 scale) */
  tension: number[];
  /** Distribution of sensory details by type */
  sensory: SensoryBalance;
  /** Current pacing trend of the scene */
  pacing: "accelerating" | "steady" | "decelerating";
  /** Overall mood or atmosphere of the scene */
  mood: string;
  /** Show-don't-tell quality score (0-100) */
  showDontTellScore: number;
  /** Letter grade for show-don't-tell quality */
  showDontTellGrade: string;
}

/**
 * Types of style issues that can be detected
 */
export type StyleIssueType = "telling" | "passive" | "adverb" | "repetition";

/**
 * Fix suggestion with old and new text for replacement
 */
export interface StyleIssueFix {
  /** Original text to replace */
  oldText: string;
  /** New text to insert */
  newText: string;
}

/**
 * A detected style issue in the writing
 */
export interface StyleIssue {
  /** Unique identifier for tracking/dismissing */
  id: string;
  /** Category of the style issue */
  type: StyleIssueType;
  /** The problematic text snippet */
  text: string;
  /** Line number where the issue occurs */
  line?: number;
  /** Character position range of the issue */
  position?: { start: number; end: number };
  /** Suggested improvement for the issue */
  suggestion: string;
  /** Optional fix that can be applied automatically */
  fix?: StyleIssueFix;
}

/**
 * Complete writing analysis result from the coach
 */
export interface WritingAnalysis {
  /** Quantitative metrics about the scene */
  metrics: SceneMetrics;
  /** List of detected style issues */
  issues: StyleIssue[];
  /** AI-generated insights about the writing */
  insights: string[];
}

/**
 * Default/empty metrics for initialization
 */
export const DEFAULT_SCENE_METRICS: SceneMetrics = {
  tension: [],
  sensory: {
    sight: 0,
    sound: 0,
    touch: 0,
    smell: 0,
    taste: 0,
  },
  pacing: "steady",
  mood: "neutral",
  showDontTellScore: 50,
  showDontTellGrade: "C",
};

/**
 * Default/empty analysis for initialization
 */
export const DEFAULT_WRITING_ANALYSIS: WritingAnalysis = {
  metrics: DEFAULT_SCENE_METRICS,
  issues: [],
  insights: [],
};
