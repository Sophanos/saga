import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

const internal = require("../../../_generated/api").internal as any;

type InvariantRule = {
  type: "document_contains";
  needle: string;
};

function isDocumentContainsRule(rule: unknown): rule is InvariantRule {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  const record = rule as Record<string, unknown>;
  return record.type === "document_contains" && typeof record.needle === "string";
}

export async function runInvariantCheckJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const documentId = payload["documentId"] as string | undefined;

  if (!documentId) {
    return { summary: "Invariant check skipped; no document context." };
  }

  const document = await ctx.runQuery(
    (internal as any)["ai/analysisJobs"].getDocumentForAnalysis,
    { id: documentId }
  );

  if (!document) {
    return { summary: "Invariant check skipped; document not found." };
  }

  const invariants = await ctx.runQuery(
    (internal as any).invariants.listEnabledInvariantsInternal,
    { projectId: job.projectId }
  );

  const applicable = invariants.filter((invariant: any) => invariant.scope === "document");
  if (applicable.length === 0) {
    return { summary: "No document invariants configured." };
  }

  const contentText = String(document.contentText ?? "");
  const violations = applicable.filter((invariant: any) => {
    if (!isDocumentContainsRule(invariant.rule)) return false;
    return !contentText.includes(invariant.rule.needle);
  });

  if (violations.length === 0) {
    return { summary: "No invariant violations detected." };
  }

  const title = `Invariant violations detected (${violations.length})`;
  const description = document.title
    ? `Document "${document.title}" violates ${violations.length} invariant(s).`
    : `Document violates ${violations.length} invariant(s).`;

  const pulseSignalId = await ctx.runMutation(
    (internal as any)["ai/analysisJobs"].createPulseSignalInternal,
    {
      projectId: job.projectId,
      signalType: "consistency_issue",
      title,
      description,
      targetDocumentId: job.documentId,
      metadata: {
        invariantIds: violations.map((violation: any) => violation._id),
        documentId,
      },
      sourceAgentId: "analysis_jobs",
    }
  );

  return {
    summary: title,
    resultRef: { pulseSignalId },
  };
}
