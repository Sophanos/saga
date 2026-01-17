"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { isQdrantConfigured, type QdrantFilter } from "./lib/qdrant";
import { deletePointsByFilterForWrite } from "./lib/qdrantCollections";

/**
 * Process pending vector delete jobs.
 * Runs in the Node runtime to avoid isolate memory carry-over.
 */
export const processVectorDeleteJobs = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; failed: number }> => {
    if (!isQdrantConfigured()) {
      console.log("[maintenance] Qdrant not configured, skipping vector delete jobs");
      return { processed: 0, failed: 0 };
    }

    const jobs = await ctx.runQuery(internal.maintenance.getPendingVectorDeleteJobs);

    if (jobs.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      const claim = await ctx.runMutation(internal.maintenance.markVectorJobProcessing, {
        jobId: job._id,
      });

      if (!claim.claimed) {
        continue;
      }

      try {
        const filter = job.filter as QdrantFilter;
        const kind = job.targetType === "image" ? "image" : "text";
        await deletePointsByFilterForWrite(filter, kind);

        await ctx.runMutation(internal.maintenance.markVectorJobCompleted, {
          jobId: job._id,
        });

        processed += 1;
        console.log(
          `[maintenance] Vector delete job completed: ${job.targetType}/${job.targetId ?? "bulk"}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isPermanent = errorMessage.includes("not found") || errorMessage.includes("404");

        await ctx.runMutation(internal.maintenance.markVectorJobFailed, {
          jobId: job._id,
          error: errorMessage,
          permanent: isPermanent,
        });

        failed += 1;
        console.error(
          `[maintenance] Vector delete job failed: ${job.targetType}/${job.targetId ?? "bulk"} - ${errorMessage}`
        );
      }
    }

    if (processed > 0 || failed > 0) {
      console.log(`[maintenance] Vector delete jobs: ${processed} processed, ${failed} failed`);
    }

    return { processed, failed };
  },
});
