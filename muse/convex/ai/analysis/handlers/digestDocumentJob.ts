import type { ActionCtx } from "../../../_generated/server";
import type { TierId } from "../../../lib/providers/types";
import { resolveExecutionContext, type ExecutionContext } from "../../llmExecution";
import type { AnalysisJobRecord } from "../../analysisJobs";
import { callOpenRouterText } from "../../toolExecutors/openRouter";
import type { AnalysisHandlerResult } from "./types";

const internal = require("../../../_generated/api").internal as any;

const DEFAULT_DIGEST_MAX_CHARS = 20000;
const DIGEST_SYSTEM_PROMPT = [
  "You are a writing assistant that creates concise document digests for authors.",
  "Return output in this exact format:",
  "Summary: <1-2 sentences>",
  "Highlights:",
  "- <bullet 1>",
  "- <bullet 2>",
  "- <bullet 3>",
  "Keep it under 120 words and use '-' bullets.",
].join("\n");

type OpenRouterExecution = {
  model: string;
  apiKey?: string;
  maxTokens: number;
  temperature?: number;
};

function resolveDigestMaxChars(): number {
  const raw = process.env["DIGEST_TEXT_MAX_CHARS"];
  if (!raw) return DEFAULT_DIGEST_MAX_CHARS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DIGEST_MAX_CHARS;
  return Math.floor(parsed);
}

function truncateDigestText(text: string): { text: string; truncated: boolean } {
  const maxChars = resolveDigestMaxChars();
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxChars), truncated: true };
}

function resolveOpenRouterExecution(exec: ExecutionContext): OpenRouterExecution {
  if (exec.resolved.provider !== "openrouter") {
    throw new Error(`Provider ${exec.resolved.provider} is not supported for digest generation`);
  }
  return {
    model: exec.resolved.model,
    apiKey: exec.apiKey,
    maxTokens: exec.maxOutputTokens,
    temperature: exec.temperature,
  };
}

function parseDigestResponse(response: string): { summary: string; digest: string } {
  const trimmed = response.trim();
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  let summary = "";

  for (const line of lines) {
    if (line.toLowerCase().startsWith("summary:")) {
      summary = line.slice("summary:".length).trim();
      break;
    }
  }

  if (!summary && lines.length > 0) {
    const nonBullet = lines.find((line) => !line.startsWith("-"));
    summary = nonBullet ?? lines[0];
  }

  return {
    summary: summary || "Digest generated.",
    digest: trimmed,
  };
}

function buildResultSummary(summary: string): string {
  const trimmed = summary.trim();
  if (!trimmed) return "Digest generated.";
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157)}...`;
}

export async function runDigestDocumentJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  if (!job.documentId) {
    return { summary: "No document provided for digest." };
  }

  const document = await ctx.runQuery((internal as any)["ai/analysisJobs"].getDocumentForAnalysis, {
    id: job.documentId,
  });

  if (!document) {
    return { summary: "Document not found; skipping digest." };
  }

  const contentText = (document.contentText ?? "").trim();
  if (!contentText) {
    return { summary: "Document is empty; skipping digest." };
  }

  const truncatedInput = truncateDigestText(contentText);
  if (truncatedInput.truncated) {
    console.warn("[analysisJobs.digest] Truncated document content for digest", {
      documentId: String(job.documentId),
      originalLength: contentText.length,
      truncatedLength: truncatedInput.text.length,
    });
  }

  const tierId = (await ctx.runQuery((internal as any)["lib/entitlements"].getUserTierInternal, {
    userId: job.userId,
  })) as TierId;

  const execution = resolveOpenRouterExecution(
    await resolveExecutionContext(ctx, {
      userId: job.userId,
      taskSlug: "summarize",
      tierId,
      promptText: truncatedInput.text,
      endpoint: "chat",
      requestedMaxOutputTokens: 800,
    })
  );

  const titleContext = document.title ? `Title: ${document.title}\n\n` : "";
  const userPrompt = `${titleContext}Document:\n${truncatedInput.text}`;

  const response = await callOpenRouterText({
    model: execution.model,
    apiKeyOverride: execution.apiKey,
    system: DIGEST_SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: Math.min(execution.maxTokens, 800),
    temperature: execution.temperature ?? 0.3,
  });

  const parsed = parseDigestResponse(response);
  const digestId = await ctx.runMutation(
    (internal as any)["documentDigests"].upsertDocumentDigestInternal,
    {
      projectId: job.projectId,
      documentId: job.documentId,
      contentHash: job.contentHash,
      summary: parsed.summary,
      digest: parsed.digest,
      model: execution.model,
      sourceJobId: job._id,
    }
  );

  return {
    summary: buildResultSummary(parsed.summary),
    resultRef: { digestId },
  };
}
