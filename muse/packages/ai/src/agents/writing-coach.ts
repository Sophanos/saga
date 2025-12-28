import { NarrativeAgent, type AnalysisContext } from "./base";
import { WRITING_COACH_SYSTEM, GENRE_COACH_CONTEXTS } from "../prompts/coach";
import type {
  WritingAnalysis,
  SceneMetrics,
  StyleIssue,
  StyleIssueFix,
} from "@mythos/core";

/**
 * Writing Coach Agent
 * Analyzes prose for tension, sensory details, show-don't-tell, and style issues.
 * Uses Gemini Flash for fast, real-time feedback.
 */
export class WritingCoach extends NarrativeAgent {
  constructor() {
    super({
      name: "WritingCoach",
      systemPrompt: WRITING_COACH_SYSTEM,
      model: "fast", // Use Gemini Flash for speed
      temperature: 0.3,
    });
  }

  /**
   * Analyze prose content and return structured writing analysis
   * @param context - Analysis context with document content
   * @param genre - Optional genre for genre-aware coaching
   */
  async analyzeWriting(
    context: AnalysisContext,
    genre?: string
  ): Promise<WritingAnalysis> {
    // Build context with genre-specific guidance if available
    const genreContext = genre && GENRE_COACH_CONTEXTS[genre.toLowerCase()];
    const enrichedContext = genreContext
      ? { ...context, additionalContext: genreContext }
      : context;

    // Get raw response from parent
    const response = await this.analyze(enrichedContext);

    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        return this.validateAndNormalize(parsed);
      }
    } catch (error) {
      console.error("[WritingCoach] Failed to parse response:", error);
      console.debug("[WritingCoach] Raw response:", response);
    }

    // Return default analysis on failure
    return this.getDefaultAnalysis();
  }

  /**
   * Quick analysis with minimal context for faster response
   */
  async quickAnalyze(content: string): Promise<WritingAnalysis> {
    return this.analyzeWriting({ documentContent: content });
  }

  /**
   * Validate and normalize the parsed analysis result
   */
  private validateAndNormalize(data: Record<string, unknown>): WritingAnalysis {
    // Validate metrics
    const metrics = this.validateMetrics(data["metrics"]);

    // Validate issues array
    const issues = this.validateIssues(data["issues"]);

    // Validate insights array
    const insights = this.validateInsights(data["insights"]);

    return { metrics, issues, insights };
  }

  /**
   * Validate and normalize metrics object
   */
  private validateMetrics(raw: unknown): SceneMetrics {
    const data = (raw as Record<string, unknown>) || {};

    // Validate tension array
    let tension: number[] = [];
    const tensionData = data["tension"];
    if (Array.isArray(tensionData)) {
      tension = tensionData
        .filter((t): t is number => typeof t === "number")
        .map((t) => Math.max(0, Math.min(100, t)));
    }

    // Validate sensory object
    const rawSensory = (data["sensory"] as Record<string, unknown>) || {};
    const sensory = {
      sight: this.clampNumber(rawSensory["sight"], 0, 100, 0),
      sound: this.clampNumber(rawSensory["sound"], 0, 100, 0),
      touch: this.clampNumber(rawSensory["touch"], 0, 100, 0),
      smell: this.clampNumber(rawSensory["smell"], 0, 100, 0),
      taste: this.clampNumber(rawSensory["taste"], 0, 100, 0),
    };

    // Validate pacing
    const validPacing = ["accelerating", "steady", "decelerating"] as const;
    const pacingData = data["pacing"];
    const pacing = validPacing.includes(pacingData as (typeof validPacing)[number])
      ? (pacingData as (typeof validPacing)[number])
      : "steady";

    // Validate mood
    const moodData = data["mood"];
    const mood = typeof moodData === "string" ? moodData : "neutral";

    // Validate show-don't-tell score and grade
    const showDontTellScore = this.clampNumber(data["showDontTellScore"], 0, 100, 50);
    const validGrades = ["A", "B", "C", "D", "F"];
    const gradeData = data["showDontTellGrade"];
    const showDontTellGrade = validGrades.includes(gradeData as string)
      ? (gradeData as string)
      : this.scoreToGrade(showDontTellScore);

    return {
      tension,
      sensory,
      pacing,
      mood,
      showDontTellScore,
      showDontTellGrade,
    };
  }

  /**
   * Generate a stable ID for a style issue based on its content
   */
  private generateIssueId(type: string, line: number | undefined, text: string): string {
    const hash = `${type}-${line ?? 0}-${text.slice(0, 32)}`;
    // Simple hash function
    let h = 0;
    for (let i = 0; i < hash.length; i++) {
      h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
    }
    return `style-${Math.abs(h).toString(36)}`;
  }

  /**
   * Validate and normalize issues array
   */
  private validateIssues(raw: unknown): StyleIssue[] {
    if (!Array.isArray(raw)) return [];

    const validTypes = ["telling", "passive", "adverb", "repetition"] as const;

    return raw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => {
        const typeData = item["type"];
        const textData = item["text"];
        const lineData = item["line"];
        const suggestionData = item["suggestion"];

        const type = validTypes.includes(typeData as (typeof validTypes)[number])
          ? (typeData as StyleIssue["type"])
          : "telling";
        const text = typeof textData === "string" ? textData : "";
        const line = typeof lineData === "number" ? lineData : undefined;

        // Parse fix object if present
        const fixData = item["fix"];
        const fix = this.validateFix(fixData, text);

        return {
          id: this.generateIssueId(type, line, text),
          type,
          text,
          line,
          position: this.validatePosition(item["position"]),
          suggestion: typeof suggestionData === "string" ? suggestionData : "",
          fix,
        };
      })
      .filter((issue) => issue.text.length > 0);
  }

  /**
   * Validate position object
   */
  private validatePosition(
    raw: unknown
  ): { start: number; end: number } | undefined {
    if (typeof raw !== "object" || raw === null) return undefined;
    const pos = raw as Record<string, unknown>;
    const startData = pos["start"];
    const endData = pos["end"];
    if (typeof startData === "number" && typeof endData === "number") {
      return { start: startData, end: endData };
    }
    return undefined;
  }

  /**
   * Validate and normalize fix object
   */
  private validateFix(
    raw: unknown,
    issueText: string
  ): StyleIssueFix | undefined {
    if (typeof raw !== "object" || raw === null) return undefined;
    const fix = raw as Record<string, unknown>;
    const oldText = fix["oldText"];
    const newText = fix["newText"];

    // Both fields must be non-empty strings
    if (typeof oldText !== "string" || typeof newText !== "string") {
      return undefined;
    }
    if (oldText.length === 0 || newText.length === 0) {
      return undefined;
    }

    // oldText should match or be very close to the issue text
    // Allow some flexibility for AI variations
    const normalizedOld = oldText.trim().toLowerCase();
    const normalizedIssue = issueText.trim().toLowerCase();
    if (!normalizedOld.includes(normalizedIssue) && !normalizedIssue.includes(normalizedOld)) {
      // Fallback: use issue text as oldText if they don't match
      return { oldText: issueText, newText: newText.trim() };
    }

    return { oldText: oldText.trim(), newText: newText.trim() };
  }

  /**
   * Validate and normalize insights array
   */
  private validateInsights(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  /**
   * Helper to clamp a number within bounds
   */
  private clampNumber(
    value: unknown,
    min: number,
    max: number,
    defaultValue: number
  ): number {
    if (typeof value !== "number" || isNaN(value)) return defaultValue;
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Convert numeric score to letter grade
   */
  private scoreToGrade(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  /**
   * Get default analysis for error cases
   */
  private getDefaultAnalysis(): WritingAnalysis {
    return {
      metrics: {
        tension: [],
        sensory: { sight: 0, sound: 0, touch: 0, smell: 0, taste: 0 },
        pacing: "steady",
        mood: "neutral",
        showDontTellScore: 50,
        showDontTellGrade: "C",
      },
      issues: [],
      insights: ["Unable to analyze text. Please try again."],
    };
  }
}

// Singleton instance for easy import
export const writingCoach = new WritingCoach();
