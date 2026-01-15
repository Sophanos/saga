import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyProjectEditor } from "./lib/auth";

type DeepLinkRequireRole = "member" | "editor";
type DeepLinkAccessReason = "unauthenticated" | "not_member" | "not_editor" | "not_found";

function mapAuthErrorToReason(
  error: unknown,
  requireRole: DeepLinkRequireRole
): DeepLinkAccessReason {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Unauthenticated")) return "unauthenticated";
  if (message.includes("Project not found")) return "not_found";
  if (requireRole === "editor" && message.includes("Edit access denied")) {
    return "not_editor";
  }
  return "not_member";
}

async function getArtifactByKey(
  ctx: { db: { query: any; get: any } },
  projectId: Id<"projects">,
  artifactKey: string
): Promise<{ _id: Id<"artifacts">; projectId: Id<"projects"> } | null> {
  const byKey = await ctx.db
    .query("artifacts")
    .withIndex("by_project_artifactKey", (q: any) =>
      q.eq("projectId", projectId).eq("artifactKey", artifactKey)
    )
    .first();
  if (byKey) return byKey;

  try {
    const byId = await ctx.db.get(artifactKey as Id<"artifacts">);
    if (byId && byId.projectId === projectId) {
      return byId;
    }
  } catch {
    // Ignore invalid IDs.
  }

  return null;
}

export const checkAccess = query({
  args: {
    projectId: v.id("projects"),
    targetType: v.union(
      v.literal("project"),
      v.literal("document"),
      v.literal("entity"),
      v.literal("artifact")
    ),
    targetId: v.string(),
    requireRole: v.optional(v.union(v.literal("member"), v.literal("editor"))),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ allowed: true } | { allowed: false; reason: DeepLinkAccessReason }> => {
    const requireRole: DeepLinkRequireRole = args.requireRole ?? "member";

    try {
      if (requireRole === "editor") {
        await verifyProjectEditor(ctx, args.projectId);
      } else {
        await verifyProjectAccess(ctx, args.projectId);
      }
    } catch (error) {
      return { allowed: false, reason: mapAuthErrorToReason(error, requireRole) };
    }

    if (args.targetType === "project") {
      return { allowed: true };
    }

    if (args.targetType === "artifact") {
      const artifact = await getArtifactByKey(ctx, args.projectId, args.targetId);
      if (!artifact) {
        return { allowed: false, reason: "not_found" };
      }
      return { allowed: true };
    }

    if (args.targetType === "document") {
      try {
        const doc = await ctx.db.get(args.targetId as Id<"documents">);
        if (!doc || doc.projectId !== args.projectId) {
          return { allowed: false, reason: "not_found" };
        }
        return { allowed: true };
      } catch {
        return { allowed: false, reason: "not_found" };
      }
    }

    if (args.targetType === "entity") {
      try {
        const entity = await ctx.db.get(args.targetId as Id<"entities">);
        if (!entity || entity.projectId !== args.projectId) {
          return { allowed: false, reason: "not_found" };
        }
        return { allowed: true };
      } catch {
        return { allowed: false, reason: "not_found" };
      }
    }

    return { allowed: false, reason: "not_found" };
  },
});
