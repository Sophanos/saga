import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess } from "./lib/auth";

const phaseSchema = v.union(
  v.literal("proposal"),
  v.literal("review"),
  v.literal("result")
);

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
      let memoryText: string | undefined;
      let memoryType: string | undefined;

      if (citation.visibility === "project") {
        const memory = await ctx.db.get(
          citation.memoryId as Id<"memories">
        );
        if (memory && memory.projectId === suggestion.projectId) {
          memoryText = memory.text;
          memoryType = memory.type;
        }
      }

      results.push({
        ...citation,
        memoryText,
        memoryType,
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
        memoryId: v.string(),
        category: v.optional(v.union(v.literal("decision"), v.literal("policy"))),
        excerpt: v.optional(v.string()),
        reason: v.optional(v.string()),
        confidence: v.optional(v.number()),
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
      const memory = await ctx.db.get(citation.memoryId as Id<"memories">);
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
        memoryId: citation.memoryId,
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
