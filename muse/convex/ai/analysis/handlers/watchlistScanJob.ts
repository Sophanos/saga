import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

export async function runWatchlistScanJob(
  _ctx: ActionCtx,
  _job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  return { summary: "Watchlist scan skipped; no rules configured." };
}
