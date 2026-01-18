import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const listEnabledInvariantsInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    return ctx.db
      .query("invariants")
      .withIndex("by_project_enabled", (q) =>
        q.eq("projectId", projectId).eq("enabled", true)
      )
      .collect();
  },
});
