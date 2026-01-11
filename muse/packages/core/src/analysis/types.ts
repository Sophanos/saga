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
export type StyleIssueType =
  | "telling"
  | "passive"
  | "adverb"
  | "repetition"
  // Clarity issue types
  | "ambiguous_pronoun"
  | "unclear_antecedent"
  | "cliche"
  | "filler_word"
  | "dangling_modifier"
  // Policy issue types
  | "policy_conflict"
  | "unverifiable"
  | "not_testable"
  | "policy_gap";

/**
 * Canon citation reference for policy violations
 */
export interface CanonCitation {
  /** Memory ID of the referenced canon */
  memoryId: string;
  /** Excerpt from the canon text */
  excerpt?: string;
  /** Reason for the citation */
  reason?: string;
}

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
  /** Canon citations for policy violations (links to pinned memories) */
  canonCitations?: CanonCitation[];
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

/**
 * Readability metrics from clarity analysis
 */
export interface ReadabilityMetrics {
  /** Flesch-Kincaid grade level (e.g., 8.6 = 8th grade) */
  fleschKincaidGrade: number;
  /** Flesch Reading Ease score (0-100, higher = easier) */
  fleschReadingEase: number;
  /** Total number of sentences */
  sentenceCount: number;
  /** Total number of words */
  wordCount: number;
  /** Average words per sentence */
  avgWordsPerSentence: number;
  /** Percentage of sentences considered "long" (>25 words) */
  longSentencePct?: number;
}

/**
 * Result of clarity analysis combining readability metrics and style issues
 */
export interface ClarityAnalysis {
  /** Readability metrics */
  metrics: ReadabilityMetrics;
  /** Detected clarity issues (as StyleIssue) */
  issues: StyleIssue[];
  /** Optional summary of the analysis */
  summary?: string;
}
