import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../../_generated/server";
import type { AnalysisJobRecord } from "../analysisJobs";
import { runClarityCheckJob } from "./handlers/clarityCheckJob";
import { runCoherenceLintJob } from "./handlers/coherenceLintJob";
import { runDetectEntitiesJob } from "./handlers/detectEntitiesJob";
import { runDigestDocumentJob } from "./handlers/digestDocumentJob";
import { runEmbeddingGenerationJob } from "./handlers/embeddingGenerationJob";
import { runImageEvidenceSuggestionsJob } from "./handlers/imageEvidenceSuggestionsJob";
import { runPolicyCheckJob } from "./handlers/policyCheckJob";
import type { AnalysisHandlerResult } from "./handlers/types";
import { isDeepInfraConfigured } from "../../lib/embeddings";
import { isQdrantConfigured } from "../../lib/qdrant";

const internal = require("../../_generated/api").internal as any;

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;
const DEFAULT_MAX_CONCURRENCY = 4;

function resolveMaxConcurrency(): number {
  const raw = process.env["ANALYSIS_JOB_MAX_CONCURRENCY"];
  if (!raw) return DEFAULT_MAX_CONCURRENCY;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_CONCURRENCY;
  return Math.min(12, Math.max(1, Math.floor(parsed)));
}

async function dispatchJob(ctx: ActionCtx, job: AnalysisJobRecord): Promise<AnalysisHandlerResult> {
  switch (job.kind) {
    case "detect_entities":
      return runDetectEntitiesJob(ctx, job);
    case "coherence_lint":
      return runCoherenceLintJob(ctx, job);
    case "clarity_check":
      return runClarityCheckJob(ctx, job);
    case "policy_check":
      return runPolicyCheckJob(ctx, job);
    case "digest_document":
      return runDigestDocumentJob(ctx, job);
    case "embedding_generation":
      return runEmbeddingGenerationJob(ctx, job);
    case "image_evidence_suggestions":
      return runImageEvidenceSuggestionsJob(ctx, job);
    default:
      throw new Error(`Unknown analysis job kind: ${job.kind}`);
  }
}

function resolveEmbeddingTargetType(job: AnalysisJobRecord): string | null {
  if (job.kind !== "embedding_generation") return null;
  if (job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)) {
    const record = job.payload as Record<string, unknown>;
    const targetType = record["targetType"];
    if (typeof targetType === "string") return targetType;
  }
  return job.documentId ? "document" : null;
}

export const processAnalysisJobs = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { batchSize }) => {
    const limit = Math.max(1, Math.min(batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE));
    const jobs = (await ctx.runQuery((internal as any)["ai/analysisJobs"].getPendingJobs, {
      limit,
    })) as AnalysisJobRecord[];

    if (jobs.length === 0) return;

    const qdrantReady = isQdrantConfigured();
    const embeddingsReady = qdrantReady && isDeepInfraConfigured();
    const concurrency = Math.min(resolveMaxConcurrency(), jobs.length);
    const queue = [...jobs];

    const workers = Array.from({ length: concurrency }).map(async () => {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) return;

        if (job.kind === "embedding_generation") {
          if (!qdrantReady) {
            continue;
          }
          const targetType = resolveEmbeddingTargetType(job);
          if (targetType !== "memory_delete" && !embeddingsReady) {
            continue;
          }
        }

        const claim = await ctx.runMutation((internal as any)["ai/analysisJobs"].claimAnalysisJob, {
          jobId: job._id,
        });

        if (!claim.claimed) {
          continue;
        }

        try {
          const result = await dispatchJob(ctx, job);
          await ctx.runMutation((internal as any)["ai/analysisJobs"].finalizeAnalysisJob, {
            jobId: job._id,
            runId: claim.runId,
            resultSummary: result.summary,
            resultRef: result.resultRef,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "analysis job failed";
          await ctx.runMutation((internal as any)["ai/analysisJobs"].markAnalysisJobFailed, {
            jobId: job._id,
            runId: claim.runId,
            errorMessage: message,
          });
        }
      }
    });

    await Promise.all(workers);
  },
});
