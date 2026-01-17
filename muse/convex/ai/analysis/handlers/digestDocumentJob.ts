import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

export async function runDigestDocumentJob(
  _ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  if (!job.documentId) {
    return { summary: "No document provided for digest." };
  }

  return {
    summary: "Digest job acknowledged; summarization not yet implemented.",
  };
}
