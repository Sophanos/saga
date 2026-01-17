import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { AnalyzeContentArgs, AnalyzeContentResult } from "../../../packages/agent-protocol/src/tools";
import type { ResponseFormat, TierId } from "../../lib/providers/types";
import { resolveExecutionContext, type ExecutionContext } from "../llmExecution";
import { executeCheckLogic, type CheckLogicInput } from "./checkLogic";
import { executeClarityCheck } from "./clarityCheck";
import { callOpenRouterJson } from "./openRouter";
import { executePolicyCheck } from "./policyCheck";

const DEFAULT_ANALYZE_TEXT_MAX_CHARS = 20000;
const ANALYZE_TEXT_MAX_CHARS = resolveAnalyzeTextMaxChars();

function resolveAnalyzeTextMaxChars(): number {
  const raw = process.env["ANALYZE_TEXT_MAX_CHARS"];
  if (!raw) return DEFAULT_ANALYZE_TEXT_MAX_CHARS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ANALYZE_TEXT_MAX_CHARS;
  return Math.floor(parsed);
}

function truncateAnalyzeText(text: string): { text: string; truncated: boolean } {
  if (text.length <= ANALYZE_TEXT_MAX_CHARS) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, ANALYZE_TEXT_MAX_CHARS), truncated: true };
}

type OpenRouterExecution = {
  model: string;
  apiKey?: string;
  responseFormat: ResponseFormat;
  maxTokens: number;
  temperature?: number;
};

function resolveOpenRouterExecution(exec: ExecutionContext): OpenRouterExecution {
  if (exec.resolved.provider !== "openrouter") {
    throw new Error(`Provider ${exec.resolved.provider} is not supported for analyze_content`);
  }
  return {
    model: exec.resolved.model,
    apiKey: exec.apiKey,
    responseFormat: exec.responseFormat,
    maxTokens: exec.maxOutputTokens,
    temperature: exec.temperature,
  };
}

async function executeCheckConsistency(input: {
  text: string;
  focus?: string[];
  entities?: Array<{
    id: string;
    name: string;
    type: string;
    properties?: Record<string, unknown>;
  }>;
  execution: OpenRouterExecution;
}): Promise<{
  issues: Array<{
    type: string;
    severity: string;
    description: string;
    location?: string;
    suggestion?: string;
  }>;
  stats: { total: number; bySeverity: Record<string, number> };
}> {
  type ConsistencyIssue = {
    type: string;
    severity: string;
    description: string;
    location?: string;
    suggestion?: string;
  };

  const focusAreas = input.focus?.length
    ? `Focus on: ${input.focus.join(", ")}`
    : "Check all consistency areas: timeline, character behavior, world rules, relationships";

  const entityContext = input.entities?.length
    ? `\nKnown entities:\n${input.entities.map((e) => `- ${e.name} (${e.type})`).join("\n")}`
    : "";

  const systemPrompt = `You are a story consistency checker. Analyze text for logical inconsistencies, timeline issues, and character behavior problems.

${focusAreas}
${entityContext}

For each issue found, provide:
- type: timeline, character, world_rule, relationship, logic
- severity: error, warning, info
- description: What the issue is
- location: Where in the text (quote if possible)
- suggestion: How to fix it

Respond with JSON containing an "issues" array.`;

  const parsed = await callOpenRouterJson<{ issues?: Array<Record<string, unknown>> }>({
    model: input.execution.model,
    system: systemPrompt,
    user: `Check this text for consistency issues:\n\n${input.text}`,
    maxTokens: Math.min(input.execution.maxTokens, 4096),
    temperature: input.execution.temperature,
    apiKeyOverride: input.execution.apiKey,
    responseFormat: input.execution.responseFormat,
  });

  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const issues: ConsistencyIssue[] = rawIssues.map((issue) => {
    const record =
      typeof issue === "object" && issue !== null ? (issue as Record<string, unknown>) : ({} as Record<string, unknown>);
    const type = typeof record["type"] === "string" ? record["type"] : "consistency";
    const severity = typeof record["severity"] === "string" ? record["severity"] : "warning";
    const description = typeof record["description"] === "string" ? record["description"] : "";
    const location = typeof record["location"] === "string" ? record["location"] : undefined;
    const suggestion = typeof record["suggestion"] === "string" ? record["suggestion"] : undefined;
    return { type, severity, description, location, suggestion };
  });

  const bySeverity: Record<string, number> = {};
  for (const issue of issues) {
    const severity = issue.severity || "unknown";
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }

  return { issues, stats: { total: issues.length, bySeverity } };
}

export async function executeAnalyzeContent(
  ctx: ActionCtx,
  input: AnalyzeContentArgs,
  projectId: string,
  userId: string
): Promise<AnalyzeContentResult> {
  const truncatedInput = truncateAnalyzeText(input.text);
  if (truncatedInput.truncated) {
    console.warn("[tools.analyze_content] Truncated analysis input", {
      originalLength: input.text.length,
      truncatedLength: truncatedInput.text.length,
      mode: input.mode,
      projectId,
    });
  }
  const text = truncatedInput.text;
  let tierId: TierId | null = null;

  const resolveTierId = async (): Promise<TierId> => {
    if (tierId) return tierId;
    tierId = (await ctx.runQuery((internal as any)["lib/entitlements"].getUserTierInternal, {
      userId,
    })) as TierId;
    return tierId;
  };

  switch (input.mode) {
    case "entities": {
      const result = await ctx.runAction((internal as any)["ai/detect"].detectEntities, {
        text,
        projectId,
        userId,
        entityTypes: input.options?.entityTypes,
        minConfidence: input.options?.minConfidence,
      });
      const entities = Array.isArray(result?.entities) ? result.entities : [];
      const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
      const summary = entities.length > 0
        ? `Detected ${entities.length} entities.`
        : "No entities detected.";
      return {
        mode: "entities",
        summary,
        entities,
        stats: { warnings },
      };
    }
    case "consistency": {
      const execution = resolveOpenRouterExecution(
        await resolveExecutionContext(ctx, {
          userId,
          taskSlug: "lint",
          tierId: await resolveTierId(),
          promptText: text,
          endpoint: "lint",
          requestedMaxOutputTokens: 4096,
        })
      );
      const result = await executeCheckConsistency({
        text,
        focus: input.options?.focus,
        execution,
      });
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: `consistency-${Date.now()}-${index}`,
        type: issue.type ?? "consistency",
        severity: issue.severity ?? "warning",
        message: issue.description ?? "",
        suggestion: issue.suggestion,
        locations: issue.location ? [{ text: issue.location }] : undefined,
      }));
      const summary = `Found ${issues.length} consistency issue${issues.length === 1 ? "" : "s"}.`;
      return {
        mode: "consistency",
        summary,
        issues: normalized,
        stats: { rawIssues: issues, totals: result.stats },
      };
    }
    case "logic": {
      const execution = resolveOpenRouterExecution(
        await resolveExecutionContext(ctx, {
          userId,
          taskSlug: "lint",
          tierId: await resolveTierId(),
          promptText: text,
          endpoint: "lint",
          requestedMaxOutputTokens: 4096,
        })
      );
      const result = await executeCheckLogic(
        {
          text,
          focus: input.options?.focus as CheckLogicInput["focus"],
          strictness: input.options?.strictness as CheckLogicInput["strictness"],
        },
        projectId,
        execution
      );
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: issue.id ?? `logic-${Date.now()}-${index}`,
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
        locations: issue.locations,
      }));
      const summary = result.summary ?? `Found ${issues.length} logic issue${issues.length === 1 ? "" : "s"}.`;
      return {
        mode: "logic",
        summary,
        issues: normalized,
        stats: { rawIssues: issues },
      };
    }
    case "clarity": {
      const execution = resolveOpenRouterExecution(
        await resolveExecutionContext(ctx, {
          userId,
          taskSlug: "clarity_check",
          tierId: await resolveTierId(),
          promptText: text,
          endpoint: "lint",
          requestedMaxOutputTokens: 4096,
        })
      );
      const result = await executeClarityCheck(
        { text, maxIssues: input.options?.maxIssues },
        projectId,
        execution
      );
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: issue.id ?? `clarity-${Date.now()}-${index}`,
        type: issue.type,
        severity: "warning",
        message: issue.text,
        suggestion: issue.suggestion,
        locations: issue.line ? [{ line: issue.line, text: issue.text }] : undefined,
      }));
      return {
        mode: "clarity",
        summary: result.summary || `Found ${issues.length} clarity issue${issues.length === 1 ? "" : "s"}.`,
        issues: normalized,
        stats: { rawIssues: issues, readability: result.readability },
      };
    }
    case "policy": {
      const execution = resolveOpenRouterExecution(
        await resolveExecutionContext(ctx, {
          userId,
          taskSlug: "policy_check",
          tierId: await resolveTierId(),
          promptText: text,
          endpoint: "lint",
          requestedMaxOutputTokens: 4096,
        })
      );
      const result = await executePolicyCheck(
        { text, maxIssues: input.options?.maxIssues },
        projectId,
        execution
      );
      const issues = result.issues ?? [];
      const normalized = issues.map((issue, index) => ({
        id: issue.id ?? `policy-${Date.now()}-${index}`,
        type: issue.type,
        severity: "warning",
        message: issue.text,
        suggestion: issue.suggestion,
        locations: issue.line ? [{ line: issue.line, text: issue.text }] : undefined,
      }));
      return {
        mode: "policy",
        summary: result.summary,
        issues: normalized,
        stats: { rawIssues: issues, compliance: result.compliance },
      };
    }
    default:
      return {
        mode: "consistency",
        summary: "Unsupported analysis mode.",
        issues: [],
      };
  }
}
