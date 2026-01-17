import type { ResponseFormat } from "../../lib/providers/types";
import { callOpenRouterJson } from "./openRouter";

export interface CheckLogicInput {
  text: string;
  focus?: ("magic_rules" | "causality" | "knowledge_state" | "power_scaling")[];
  strictness?: "strict" | "balanced" | "lenient";
  magicSystems?: Array<{
    id: string;
    name: string;
    rules: string[];
    limitations: string[];
    costs?: string[];
  }>;
  characters?: Array<{
    id: string;
    name: string;
    powerLevel?: number;
    knowledge?: string[];
  }>;
}

interface LogicIssue {
  id: string;
  type: "magic_rule_violation" | "causality_break" | "knowledge_violation" | "power_scaling_violation";
  severity: "error" | "warning" | "info";
  message: string;
  violatedRule?: {
    source: string;
    ruleText: string;
    sourceEntityId?: string;
    sourceEntityName?: string;
  };
  suggestion?: string;
  locations?: Array<{
    line?: number;
    startOffset?: number;
    endOffset?: number;
    text: string;
  }>;
}

interface CheckLogicResult {
  issues: LogicIssue[];
  summary?: string;
}

type OpenRouterExecution = {
  model: string;
  apiKey?: string;
  responseFormat: ResponseFormat;
  maxTokens: number;
  temperature?: number;
};

const CHECK_LOGIC_SYSTEM = `You are a story logic validator. Check text for logical consistency against established rules and world state.

Analyze for:
1. Magic rule violations - actions that break the magic system's rules or limitations
2. Causality breaks - effects without causes, or impossible sequences of events
3. Knowledge violations - characters knowing things they shouldn't
4. Power scaling violations - characters doing things beyond their established abilities

For each issue, provide:
- type: magic_rule_violation, causality_break, knowledge_violation, power_scaling_violation
- severity: error (definitely wrong), warning (likely wrong), info (might be intentional)
- message: What the issue is
- violatedRule: { source, ruleText, sourceEntityId?, sourceEntityName? } if applicable
- suggestion: How to fix it
- locations: Array of { line?, text } showing where the issue occurs

Respond with JSON containing an "issues" array and optional "summary".`;

export async function executeCheckLogic(
  input: CheckLogicInput,
  _projectId: string,
  execution: OpenRouterExecution
): Promise<CheckLogicResult> {
  const strictness = input.strictness ?? "balanced";
  const focusAreas = input.focus?.length
    ? `Focus on: ${input.focus.join(", ")}`
    : "Check all logic areas";

  // Build context from magic systems and characters
  const contextParts: string[] = [];

  if (input.magicSystems?.length) {
    const magicContext = input.magicSystems.map((ms) => {
      const parts = [`Magic System: ${ms.name} (${ms.id})`];
      parts.push(`Rules: ${ms.rules.join("; ")}`);
      parts.push(`Limitations: ${ms.limitations.join("; ")}`);
      if (ms.costs?.length) parts.push(`Costs: ${ms.costs.join("; ")}`);
      return parts.join("\n");
    }).join("\n\n");
    contextParts.push(`## Magic Systems:\n${magicContext}`);
  }

  if (input.characters?.length) {
    const charContext = input.characters.map((c) => {
      const parts = [`Character: ${c.name} (${c.id})`];
      if (c.powerLevel !== undefined) parts.push(`Power Level: ${c.powerLevel}`);
      if (c.knowledge?.length) parts.push(`Known: ${c.knowledge.join(", ")}`);
      return parts.join(" | ");
    }).join("\n");
    contextParts.push(`## Characters:\n${charContext}`);
  }

  const contextBlock = contextParts.length
    ? `\n\n${contextParts.join("\n\n")}`
    : "";

  const userContent = `${focusAreas}\nStrictness: ${strictness}${contextBlock}\n\n## Text to Analyze:\n${input.text}`;

  const parsed = await callOpenRouterJson<{ issues?: unknown[]; summary?: string }>({
    model: execution.model,
    system: CHECK_LOGIC_SYSTEM,
    user: userContent,
    maxTokens: Math.min(execution.maxTokens, 4096),
    temperature: execution.temperature,
    apiKeyOverride: execution.apiKey,
    responseFormat: execution.responseFormat,
  });
  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const issues = rawIssues.map((issue, idx) => {
    const record =
      typeof issue === "object" && issue !== null ? (issue as Record<string, unknown>) : {};
    return {
      id: `logic-${Date.now()}-${idx}`,
      type: record["type"] as LogicIssue["type"],
      severity: record["severity"] as LogicIssue["severity"],
      message: record["message"] as string,
      violatedRule: record["violatedRule"] as LogicIssue["violatedRule"],
      suggestion: record["suggestion"] as string | undefined,
      locations: record["locations"] as LogicIssue["locations"],
    };
  });

  return {
    issues,
    summary: parsed.summary || `Found ${issues.length} logic issues.`,
  };
}
