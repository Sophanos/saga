import { CLARITY_CHECK_SYSTEM } from "../prompts/clarity";
import type { ResponseFormat } from "../../lib/providers/types";
import { getPinnedPoliciesForProject } from "./policyContext";
import { callOpenRouterJson } from "./openRouter";

interface ClarityCheckResult {
  issues: Array<{
    id?: string;
    type: string;
    text: string;
    line?: number;
    suggestion: string;
    fix?: { oldText: string; newText: string };
  }>;
  summary: string;
  readability?: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    longSentencePct: number;
  };
  metrics?: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    longSentencePct: number;
  };
}

type OpenRouterExecution = {
  model: string;
  apiKey?: string;
  responseFormat: ResponseFormat;
  maxTokens: number;
  temperature?: number;
};

export async function executeClarityCheck(
  input: { text: string; maxIssues?: number },
  projectId: string,
  execution: OpenRouterExecution
): Promise<ClarityCheckResult> {
  const policyContext = await getPinnedPoliciesForProject(projectId, {
    limit: 25,
    categories: ["policy"],
  });
  const policyText = policyContext?.text;

  const userContent = policyText
    ? `## Pinned Policies:\n${policyText}\n\n## Text to Analyze:\n${input.text}`
    : input.text;

  const parsed = await callOpenRouterJson<{
    issues?: Array<Record<string, unknown>>;
    summary?: string;
    readability?: ClarityCheckResult["readability"];
  }>({
    model: execution.model,
    system: CLARITY_CHECK_SYSTEM,
    user: userContent,
    maxTokens: Math.min(execution.maxTokens, 4096),
    temperature: execution.temperature,
    apiKeyOverride: execution.apiKey,
    responseFormat: execution.responseFormat,
  });

  // Add IDs to issues for UI tracking
  const issues = (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
    id: `clarity-${Date.now()}-${idx}`,
    type: issue["type"] as string,
    text: issue["text"] as string,
    line: issue["line"] as number | undefined,
    suggestion: issue["suggestion"] as string,
    fix: issue["fix"] as { oldText: string; newText: string } | undefined,
  }));

  const readability = parsed.readability as ClarityCheckResult["readability"] | undefined;

  return {
    issues,
    summary: parsed.summary || "Clarity analysis complete.",
    readability,
    metrics: readability,
  };
}
