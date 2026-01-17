import { POLICY_CHECK_SYSTEM } from "../prompts/policy";
import { getPinnedPoliciesForProject } from "./policyContext";
import { DEFAULT_MODEL, OPENROUTER_API_URL } from "./openRouter";

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

export async function executePolicyCheck(
  input: { text: string; maxIssues?: number },
  projectId: string
): Promise<PolicyCheckResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

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
        { role: "system", content: POLICY_CHECK_SYSTEM },
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
    return {
      issues: [],
      summary: "Unable to analyze text against policies.",
      compliance: {
        score: 100,
        policiesChecked: policyCount,
        conflictsFound: 0,
      },
    };
  }

  const parsed = JSON.parse(content);

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
