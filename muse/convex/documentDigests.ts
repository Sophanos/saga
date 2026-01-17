import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const upsertDocumentDigestInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    contentHash: v.optional(v.string()),
    summary: v.string(),
    digest: v.string(),
    model: v.optional(v.string()),
    sourceJobId: v.optional(v.id("analysisJobs")),
  },
  handler: async (ctx, args): Promise<Id<"documentDigests">> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("documentDigests")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contentHash: args.contentHash,
        summary: args.summary,
        digest: args.digest,
        model: args.model,
        sourceJobId: args.sourceJobId,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("documentDigests", {
      projectId: args.projectId,
      documentId: args.documentId,
      contentHash: args.contentHash,
      summary: args.summary,
      digest: args.digest,
      model: args.model,
      sourceJobId: args.sourceJobId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
