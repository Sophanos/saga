import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

const internal = require("../../../_generated/api").internal as any;

export async function runPolicyCheckJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  if (!job.documentId) {
    return { summary: "No document provided for policy check." };
  }

  const document = await ctx.runQuery((internal as any)["ai/analysisJobs"].getDocumentForAnalysis, {
    id: job.documentId,
  });

  if (!document) {
    return { summary: "Document not found; skipping policy check." };
  }

  const contentText = (document.contentText ?? "").trim();
  if (!contentText) {
    return { summary: "Document is empty; skipping policy check." };
  }

  const result = await ctx.runAction((internal as any)["ai/tools"].execute, {
    toolName: "analyze_content",
    input: { mode: "policy", text: contentText },
    projectId: String(job.projectId),
    userId: job.userId,
  });

  const issues = Array.isArray(result?.issues) ? result.issues : [];
  if (issues.length === 0) {
    return { summary: result?.summary ?? "No policy issues detected." };
  }

  const title = `Policy issues found (${issues.length})`;
  const description = document.title
    ? `Detected ${issues.length} policy issues in "${document.title}".`
    : `Detected ${issues.length} policy issues in this document.`;
  const excerpt = issues[0]?.locations?.[0]?.text ?? contentText.slice(0, 240);

  const pulseSignalId = await ctx.runMutation(
    (internal as any)["ai/analysisJobs"].createPulseSignalInternal,
    {
      projectId: job.projectId,
      signalType: "suggestion",
      title,
      description,
      targetDocumentId: job.documentId,
      excerpt,
      metadata: {
        issueCount: issues.length,
      },
      sourceAgentId: "analysis_jobs",
    }
  );

  return {
    summary: title,
    resultRef: { pulseSignalId },
  };
}
