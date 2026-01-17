import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { verifyProjectAccess } from "./lib/auth";

const phaseSchema = v.union(
  v.literal("proposal"),
  v.literal("review"),
  v.literal("result")
);

function resolveCitationSourceKind(value: unknown): "memory" | "image_region" {
  return value === "image_region" ? "image_region" : "memory";
}

function resolveMemoryCategory(
  memoryType: string | undefined,
  category?: "decision" | "policy"
): "decision" | "policy" | undefined {
  if (category) return category;
  if (memoryType === "decision" || memoryType === "policy") return memoryType;
  return undefined;
}

export const listBySuggestion = query({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
  },
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) return [];

    await verifyProjectAccess(ctx, suggestion.projectId);

    const citations = await ctx.db
      .query("knowledgeCitations")
      .withIndex("by_project_target", (q) =>
        q
          .eq("projectId", suggestion.projectId)
          .eq("targetKind", "knowledgeSuggestion")
          .eq("targetId", String(suggestionId))
      )
      .order("asc")
      .collect();

    const results: Array<Record<string, unknown>> = [];

    for (const citation of citations) {
      const sourceKind = resolveCitationSourceKind(citation.sourceKind);
      let memoryText: string | undefined;
      let memoryType: string | undefined;
      let imageUrl: string | null | undefined;
      let region: Doc<"assetRegions"> | null | undefined;

      if (sourceKind === "memory" && citation.visibility === "project" && citation.memoryId) {
        const memory = await ctx.db.get(
          citation.memoryId as Id<"memories">
        );
        if (memory && memory.projectId === suggestion.projectId) {
          memoryText = memory.text;
          memoryType = memory.type;
        }
      }

      if (sourceKind === "image_region" && citation.assetId) {
        const asset = await ctx.db.get(citation.assetId as Id<"projectAssets">);
        if (asset && asset.projectId === suggestion.projectId && !asset.deletedAt) {
          imageUrl = await ctx.storage.getUrl(asset.storageId);
        }
        if (citation.regionId) {
          const resolvedRegion = await ctx.db.get(citation.regionId as Id<"assetRegions">);
          if (resolvedRegion && resolvedRegion.projectId === suggestion.projectId && !resolvedRegion.deletedAt) {
            region = resolvedRegion;
          }
        }
      }

      results.push({
        ...citation,
        sourceKind,
        memoryText,
        memoryType,
        imageUrl,
        region,
      });
    }

    return results;
  },
});

export const createForSuggestion = internalMutation({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
    citations: v.array(
      v.object({
        sourceKind: v.optional(v.union(v.literal("memory"), v.literal("image_region"))),
        memoryId: v.optional(v.string()),
        category: v.optional(v.union(v.literal("decision"), v.literal("policy"))),
        excerpt: v.optional(v.string()),
        reason: v.optional(v.string()),
        confidence: v.optional(v.number()),
        assetId: v.optional(v.id("projectAssets")),
        regionId: v.optional(v.id("assetRegions")),
        selector: v.optional(v.string()),
      })
    ),
    phase: phaseSchema,
    actorType: v.string(),
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    const now = Date.now();
    const projectId = suggestion.projectId;
    let inserted = 0;

    for (const citation of args.citations) {
      const sourceKind = resolveCitationSourceKind(citation.sourceKind);
      if (sourceKind === "image_region") {
        const assetId = citation.assetId;
        if (!assetId) continue;
        const asset = await ctx.db.get(assetId);
        if (!asset || asset.projectId !== projectId) continue;
        let regionId = citation.regionId;
        let selector = citation.selector;
        if (regionId) {
          const region = await ctx.db.get(regionId);
          if (!region || region.projectId !== projectId) {
            regionId = undefined;
          } else {
            selector = selector ?? region.selector;
          }
        }

        await ctx.db.insert("knowledgeCitations", {
          projectId,
          targetKind: "knowledgeSuggestion",
          targetId: String(args.suggestionId),
          phase: args.phase,
          sourceKind,
          memoryId: undefined,
          memoryCategory: undefined,
          assetId,
          regionId,
          selector,
          excerpt: citation.excerpt,
          reason: citation.reason,
          confidence: citation.confidence,
          actorType: args.actorType,
          actorUserId: args.actorUserId,
          actorAgentId: args.actorAgentId,
          actorName: args.actorName,
          visibility: "project",
          redactionReason: undefined,
          createdAt: now,
          updatedAt: now,
        });

        inserted += 1;
        continue;
      }

      const memoryId = citation.memoryId;
      if (!memoryId) continue;
      const memory = await ctx.db.get(memoryId as Id<"memories">);
      if (!memory) continue;
      if (memory.projectId !== projectId) continue;

      const memoryScope = memory.scope ?? "project";
      let visibility: "project" | "private" | "redacted" = "project";
      let redactionReason: string | undefined;
      let excerpt = citation.excerpt;
      let reason = citation.reason;

      if (memoryScope === "private") {
        visibility = "redacted";
        redactionReason = "private_memory";
        excerpt = undefined;
        reason = undefined;
      }

      await ctx.db.insert("knowledgeCitations", {
        projectId,
        targetKind: "knowledgeSuggestion",
        targetId: String(args.suggestionId),
        phase: args.phase,
        sourceKind,
        memoryId,
        memoryCategory: resolveMemoryCategory(memory.type, citation.category),
        excerpt,
        reason,
        confidence: citation.confidence,
        actorType: args.actorType,
        actorUserId: args.actorUserId,
        actorAgentId: args.actorAgentId,
        actorName: args.actorName,
        visibility,
        redactionReason,
        createdAt: now,
        updatedAt: now,
      });

      inserted += 1;
    }

    return { inserted };
  },
});
