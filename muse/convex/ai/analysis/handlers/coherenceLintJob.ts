import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

const internal = require("../../../_generated/api").internal as any;

export async function runCoherenceLintJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  if (!job.documentId) {
    return { summary: "No document provided for coherence lint." };
  }

  const document = await ctx.runQuery((internal as any)["ai/analysisJobs"].getDocumentForAnalysis, {
    id: job.documentId,
  });

  if (!document) {
    return { summary: "Document not found; skipping coherence lint." };
  }

  const contentText = (document.contentText ?? "").trim();
  if (!contentText) {
    return { summary: "Document is empty; skipping coherence lint." };
  }

  const tierId = await ctx.runQuery((internal as any)["lib/entitlements"].getUserTierInternal, {
    userId: job.userId,
  });

  const result = await ctx.runAction((internal as any)["ai/lint"].runLint, {
    projectId: String(job.projectId),
    userId: job.userId,
    documentContent: contentText,
    tierId,
  });

  const issues = Array.isArray(result?.issues) ? result.issues : [];
  if (issues.length === 0) {
    return { summary: "No consistency issues detected." };
  }

  const title = `Consistency issues found (${issues.length})`;
  const description = document.title
    ? `Detected ${issues.length} consistency issues in "${document.title}".`
    : `Detected ${issues.length} consistency issues in this document.`;
  const excerpt = issues[0]?.location?.text ?? contentText.slice(0, 240);

  const pulseSignalId = await ctx.runMutation(
    (internal as any)["ai/analysisJobs"].createPulseSignalInternal,
    {
      projectId: job.projectId,
      signalType: "consistency_issue",
      title,
      description,
      targetDocumentId: job.documentId,
      excerpt,
      metadata: {
        issueCount: issues.length,
        types: issues
          .map((issue: { type?: string }) => issue.type)
          .filter(Boolean)
          .slice(0, 8),
      },
      sourceAgentId: "analysis_jobs",
    }
  );

  return {
    summary: title,
    resultRef: { pulseSignalId },
  };
}
