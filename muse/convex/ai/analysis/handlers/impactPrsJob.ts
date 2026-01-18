import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

const internal = require("../../../_generated/api").internal as any;

export async function runImpactPrsJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const changeEventId = payload["changeEventId"] as string | undefined;

  if (!changeEventId) {
    return { summary: "Impact PR job missing changeEventId." };
  }

  const changeEvent = await ctx.runQuery(
    (internal as any).changeEvents.getChangeEventInternal,
    { id: changeEventId }
  );

  if (!changeEvent) {
    return { summary: "Change event not found for impact PR job." };
  }

  const title = `Impact review needed: ${changeEvent.operation}`;
  const description = `Change detected on ${changeEvent.targetType}; review downstream docs for consistency.`;

  const pulseSignalId = await ctx.runMutation(
    (internal as any)["ai/analysisJobs"].createPulseSignalInternal,
    {
      projectId: job.projectId,
      signalType: "suggestion",
      title,
      description,
      metadata: {
        changeEventId,
        targetType: changeEvent.targetType,
        targetId: changeEvent.targetId,
        operation: changeEvent.operation,
      },
      sourceAgentId: "analysis_jobs",
    }
  );

  return {
    summary: title,
    resultRef: { pulseSignalId },
  };
}
