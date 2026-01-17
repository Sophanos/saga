import { DEFAULT_MODEL, OPENROUTER_API_URL } from "./openRouter";

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
  _projectId: string
): Promise<CheckLogicResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

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

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://mythos.app",
      "X-Title": "Saga AI",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: CHECK_LOGIC_SYSTEM },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return { issues: [], summary: "Unable to analyze text." };
  }

  const parsed = JSON.parse(content);
  const issues = (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
    id: `logic-${Date.now()}-${idx}`,
    type: issue["type"] as LogicIssue["type"],
    severity: issue["severity"] as LogicIssue["severity"],
    message: issue["message"] as string,
    violatedRule: issue["violatedRule"] as LogicIssue["violatedRule"],
    suggestion: issue["suggestion"] as string | undefined,
    locations: issue["locations"] as LogicIssue["locations"],
  }));

  return {
    issues,
    summary: parsed.summary || `Found ${issues.length} logic issues.`,
  };
}
