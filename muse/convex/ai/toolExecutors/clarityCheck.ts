import { CLARITY_CHECK_SYSTEM } from "../prompts/clarity";
import { getPinnedPoliciesForProject } from "./policyContext";
import { DEFAULT_MODEL, OPENROUTER_API_URL } from "./openRouter";

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

export async function executeClarityCheck(
  input: { text: string; maxIssues?: number },
  projectId: string
): Promise<ClarityCheckResult> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const policyContext = await getPinnedPoliciesForProject(projectId, {
    limit: 25,
    categories: ["policy"],
  });
  const policyText = policyContext?.text;

  const userContent = policyText
    ? `## Pinned Policies:\n${policyText}\n\n## Text to Analyze:\n${input.text}`
    : input.text;

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
        { role: "system", content: CLARITY_CHECK_SYSTEM },
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
      summary: "Unable to analyze text.",
    };
  }

  const parsed = JSON.parse(content);

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
