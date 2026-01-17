import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

const internal = require("../../../_generated/api").internal as any;

export async function runDetectEntitiesJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  if (!job.documentId) {
    return { summary: "No document provided for entity detection." };
  }

  const document = await ctx.runQuery((internal as any)["ai/analysisJobs"].getDocumentForAnalysis, {
    id: job.documentId,
  });

  if (!document) {
    return { summary: "Document not found; skipping entity detection." };
  }

  const contentText = (document.contentText ?? "").trim();
  if (!contentText) {
    return { summary: "Document is empty; skipping entity detection." };
  }

  const result = await ctx.runAction((internal as any)["ai/detect"].detectEntities, {
    text: contentText,
    projectId: String(job.projectId),
    userId: job.userId,
  });

  const entities = Array.isArray(result?.entities) ? result.entities : [];
  if (entities.length === 0) {
    return { summary: "No entities detected." };
  }

  const title = `New entities detected (${entities.length})`;
  const description = document.title
    ? `Detected ${entities.length} entities in "${document.title}".`
    : `Detected ${entities.length} entities in this document.`;

  const pulseSignalId = await ctx.runMutation(
    (internal as any)["ai/analysisJobs"].createPulseSignalInternal,
    {
      projectId: job.projectId,
      signalType: "entity_detected",
      title,
      description,
      targetDocumentId: job.documentId,
      excerpt: contentText.slice(0, 240),
      metadata: {
        entityCount: entities.length,
        entityNames: entities.map((entity: { name?: string }) => entity.name).filter(Boolean).slice(0, 8),
      },
      sourceAgentId: "analysis_jobs",
    }
  );

  return {
    summary: title,
    resultRef: { pulseSignalId },
  };
}
