import { POLICY_CHECK_SYSTEM } from "../prompts/policy";
import type { ResponseFormat } from "../../lib/providers/types";
import { getPinnedPoliciesForProject } from "./policyContext";
import { callOpenRouterJson } from "./openRouter";

interface PolicyCheckResult {
  issues: Array<{
    id?: string;
    type: "policy_conflict" | "unverifiable" | "not_testable" | "policy_gap";
    text: string;
    line?: number;
    suggestion: string;
    canonCitations?: Array<{
      memoryId: string;
      excerpt?: string;
      reason?: string;
    }>;
  }>;
  summary: string;
  compliance?: {
    score: number;
    policiesChecked: number;
    conflictsFound: number;
  };
}

type OpenRouterExecution = {
  model: string;
  apiKey?: string;
  responseFormat: ResponseFormat;
  maxTokens: number;
  temperature?: number;
};

export async function executePolicyCheck(
  input: { text: string; maxIssues?: number },
  projectId: string,
  execution: OpenRouterExecution
): Promise<PolicyCheckResult> {
  const policyContext = await getPinnedPoliciesForProject(projectId, {
    limit: 50,
    categories: ["policy", "decision"],
  });

  if (!policyContext) {
    return {
      issues: [],
      summary: "No policies pinned; nothing to check. Pin some style rules or project policies first.",
      compliance: {
        score: 100,
        policiesChecked: 0,
        conflictsFound: 0,
      },
    };
  }

  const { text: policyText, count: policyCount } = policyContext;
  const userContent = `## Pinned Policies:\n${policyText}\n\n## Text to Check:\n${input.text}`;

  const parsed = await callOpenRouterJson<{
    issues?: Array<Record<string, unknown>>;
    summary?: string;
    compliance?: PolicyCheckResult["compliance"];
  }>({
    model: execution.model,
    system: POLICY_CHECK_SYSTEM,
    user: userContent,
    maxTokens: Math.min(execution.maxTokens, 4096),
    temperature: execution.temperature,
    apiKeyOverride: execution.apiKey,
    responseFormat: execution.responseFormat,
  });

  // Add IDs to issues for UI tracking
  const issues = (parsed.issues || []).map((issue: Record<string, unknown>, idx: number) => ({
    id: `policy-${Date.now()}-${idx}`,
    type: issue["type"] as PolicyCheckResult["issues"][0]["type"],
    text: issue["text"] as string,
    line: issue["line"] as number | undefined,
    suggestion: issue["suggestion"] as string,
    canonCitations: issue["canonCitations"] as PolicyCheckResult["issues"][0]["canonCitations"],
  }));

  return {
    issues,
    summary: parsed.summary || `Checked against ${policyCount} policies.`,
    compliance: parsed.compliance || {
      score: 100 - issues.filter((i: { type: string }) => i.type === "policy_conflict").length * 10,
      policiesChecked: policyCount,
      conflictsFound: issues.filter((i: { type: string }) => i.type === "policy_conflict").length,
    },
  };
}
