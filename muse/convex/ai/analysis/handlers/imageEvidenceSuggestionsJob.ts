import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";

const internal = require("../../../_generated/api").internal as any;

function normalizeCharacterList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

export async function runImageEvidenceSuggestionsJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  const payload = job.payload as Record<string, unknown> | null;
  const assetId = typeof payload?.["assetId"] === "string" ? (payload["assetId"] as string) : undefined;
  if (!assetId) {
    return { summary: "No asset provided for evidence suggestions." };
  }

  const asset = await ctx.runQuery((internal as any).projectAssets.getInternal, {
    id: assetId,
  });
  if (!asset || asset.projectId !== job.projectId) {
    return { summary: "Asset not found; skipping evidence suggestions." };
  }

  const imageUrl = await ctx.runQuery((internal as any).projectAssets.getUrl, {
    storageId: asset.storageId,
  });
  if (!imageUrl) {
    return { summary: "Image URL unavailable; skipping evidence suggestions." };
  }

  const analysis = await ctx.runAction((internal as any).ai.image.analyzeImageAction, {
    projectId: String(job.projectId),
    userId: job.userId,
    imageUrl,
    analysisPrompt:
      "Identify any named characters or entities in this image. Return JSON with a `characters` array of canonical names if possible.",
  });

  const characters = normalizeCharacterList(analysis?.characters);
  if (characters.length === 0) {
    return { summary: "No recognizable characters found." };
  }

  let created = 0;

  for (const name of characters) {
    const matches = (await ctx.runQuery(
      (internal as any)["ai/tools/projectGraphHandlers"].findEntityByCanonical,
      {
        projectId: job.projectId,
        name,
      }
    )) as Array<{ _id: string; name: string }> | null;

    if (!matches || matches.length !== 1) continue;
    const entity = matches[0];
    const toolCallId = `image_evidence:${assetId}:${entity._id}`;

    await ctx.runMutation((internal as any).knowledgeSuggestions.upsertFromToolApprovalRequest, {
      projectId: job.projectId,
      toolCallId,
      toolName: "evidence_mutation",
      approvalType: "execution",
      danger: "safe",
      riskLevel: "low",
      operation: "evidence.link.create",
      targetType: "entity",
      targetId: entity._id,
      proposedPatch: {
        ops: [
          {
            type: "link.create",
            assetId,
            targetType: "entity",
            targetId: entity._id,
            relation: "depicts",
            note: `Suggested by image analysis for ${entity.name}.`,
          },
        ],
      },
      preview: {
        kind: "evidence",
        assetId,
        imageUrl,
        links: [
          {
            targetType: "entity",
            targetId: entity._id,
            targetLabel: entity.name,
            relation: "depicts",
          },
        ],
      },
      actorType: "ai",
      actorAgentId: "analysis_jobs",
      actorUserId: job.userId,
    });

    created += 1;
  }

  if (created === 0) {
    return { summary: "No entity matches found for image evidence." };
  }

  return {
    summary: `Suggested evidence links (${created})`,
    resultRef: { assetId, suggested: created },
  };
}
