import { NarrativeAgent, type AnalysisContext } from "./base";
import { CONSISTENCY_LINTER_SYSTEM } from "../prompts/linter";

/**
 * Canon choice for resolving a contradiction
 */
export interface CanonChoice {
  id: string;
  label: string;
  explanation: string;
  entityName?: string;
  propertyKey?: string;
  value?: unknown;
}

/**
 * Evidence of a contradiction
 */
export interface ContradictionEvidence {
  line: number;
  text: string;
}

export interface CanonCitation {
  memoryId: string;
  excerpt?: string;
  reason?: string;
}

/**
 * A consistency issue found in the narrative
 */
export interface ConsistencyIssue {
  type: "character" | "world" | "plot" | "timeline";
  severity: "info" | "warning" | "error";
  location: { line: number; text: string };
  message: string;
  suggestion: string;
  relatedLocations?: { line: number; text: string }[];
  canonCitations?: CanonCitation[];

  // Contradiction-specific fields
  isContradiction?: boolean;
  canonQuestion?: string;
  canonChoices?: CanonChoice[];
  evidence?: ContradictionEvidence[];
}

export interface ConsistencyResult {
  issues: ConsistencyIssue[];
}

export class ConsistencyLinter extends NarrativeAgent {
  constructor() {
    super({
      name: "ConsistencyLinter",
      systemPrompt: CONSISTENCY_LINTER_SYSTEM,
      model: "analysis",
      temperature: 0.2,
    });
  }

  async lint(context: AnalysisContext): Promise<ConsistencyResult> {
    const response = await this.analyze(context);

    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ConsistencyResult;
      }
    } catch (error) {
      // If parsing fails, return empty result
      console.error("[ConsistencyLinter] Failed to parse linter response:", error, response);
    }

    return { issues: [] };
  }
}

// Singleton instance
export const consistencyLinter = new ConsistencyLinter();
