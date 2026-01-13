import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

type LegacyChunk = {
  index: number;
};

type StreamSummary = {
  _id: Id<"generationStreams">;
  chunkCount?: number;
  legacyChunkCount: number;
};

type LegacyCleanupPage = {
  summaries: StreamSummary[];
  continueCursor: string | null;
};

type LegacyCleanupResult = {
  scanned: number;
  updated: number;
  skipped: number;
  continueCursor: string | null;
};

export const listStreamsForLegacyCleanup = internalQuery({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { limit = 20, cursor }) => {
    const page = await ctx.db
      .query("generationStreams")
      .order("desc")
      .paginate({ cursor: cursor ?? null, numItems: limit });

    const summaries = page.page.map((stream) => {
      const legacyChunks = (stream as { chunks?: LegacyChunk[] }).chunks;
      return {
        _id: stream._id,
        chunkCount: stream.chunkCount,
        legacyChunkCount: legacyChunks?.length ?? 0,
      } satisfies StreamSummary;
    });

    return {
      summaries,
      continueCursor: page.continueCursor,
    };
  },
});

export const dropLegacyStreamChunks = internalMutation({
  args: {
    id: v.id("generationStreams"),
    legacyChunkCount: v.number(),
    chunkCount: v.optional(v.number()),
  },
  handler: async (ctx, { id, legacyChunkCount, chunkCount }) => {
    const nextChunkCount = Math.max(chunkCount ?? 0, legacyChunkCount);
    await ctx.db.patch(id, {
      chunks: undefined,
      chunkCount: nextChunkCount,
      updatedAt: Date.now(),
    });
  },
});

export const cleanupLegacyStreamChunks: ReturnType<typeof internalAction> = internalAction({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { limit = 20, cursor }): Promise<LegacyCleanupResult> => {
    const page: LegacyCleanupPage = await ctx.runQuery(
      (internal as any)["migrations/cleanupLegacyStreamChunks"].listStreamsForLegacyCleanup,
      { limit, cursor }
    );

    let updated = 0;
    let skipped = 0;

    for (const summary of page.summaries) {
      if (summary.legacyChunkCount === 0) {
        skipped += 1;
        continue;
      }

      await ctx.runMutation(
        (internal as any)["migrations/cleanupLegacyStreamChunks"].dropLegacyStreamChunks,
        {
          id: summary._id,
          legacyChunkCount: summary.legacyChunkCount,
          chunkCount: summary.chunkCount,
        }
      );
      updated += 1;
    }

    return {
      scanned: page.summaries.length,
      updated,
      skipped,
      continueCursor: page.continueCursor,
    };
  },
});
