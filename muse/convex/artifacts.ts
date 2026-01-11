import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyProjectEditor } from "./lib/auth";

export type ArtifactStaleness = "fresh" | "stale" | "missing";

export const createFromExecution = mutation({
  args: {
    projectId: v.id("projects"),
    executionId: v.id("widgetExecutions"),
    title: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const { projectId, executionId, title, type } = args;
    const { userId } = await verifyProjectEditor(ctx, projectId);

    const execution = await ctx.db.get(executionId);
    if (!execution || execution.projectId !== projectId) {
      throw new Error("Widget execution not found");
    }

    if (!execution.output) {
      throw new Error("Widget output missing");
    }

    const now = Date.now();
    const artifactId = await ctx.db.insert("artifacts", {
      projectId,
      createdBy: userId,
      type,
      status: "draft",
      title,
      content: execution.output,
      sources: execution.sources ?? [],
      executionContext: {
        widgetId: execution.widgetId,
        widgetVersion: execution.widgetVersion,
        model: execution.model ?? "",
        inputs: {
          documentId: execution.documentId,
          selectionText: execution.selectionText,
          selectionRange: execution.selectionRange,
          parameters: execution.parameters,
        },
        startedAt: execution.startedAt,
        completedAt: execution.completedAt ?? now,
      },
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("artifactVersions", {
      projectId,
      artifactId,
      version: 1,
      content: execution.output,
      sources: execution.sources ?? [],
      executionContext: execution.model
        ? {
            widgetId: execution.widgetId,
            widgetVersion: execution.widgetVersion,
            model: execution.model,
            inputs: execution.parameters ?? {},
            startedAt: execution.startedAt,
            completedAt: execution.completedAt ?? now,
          }
        : undefined,
      createdAt: now,
    });

    return artifactId;
  },
});

export const updateSources = mutation({
  args: {
    artifactId: v.id("artifacts"),
    add: v.optional(
      v.array(v.object({ type: v.string(), id: v.string() }))
    ),
    remove: v.optional(
      v.array(v.object({ type: v.string(), id: v.string() }))
    ),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    await verifyProjectEditor(ctx, artifact.projectId);

    let sources = [...artifact.sources];
    const now = Date.now();

    if (args.remove?.length) {
      const removeSet = new Set(args.remove.map((item) => `${item.type}:${item.id}`));
      sources = sources.filter((source) => !removeSet.has(`${source.type}:${source.id}`));
    }

    if (args.add?.length) {
      for (const item of args.add) {
        const key = `${item.type}:${item.id}`;
        if (sources.some((source) => `${source.type}:${source.id}` === key)) {
          continue;
        }

        const resolved = await resolveSource(ctx, artifact.projectId, item.type, item.id);
        sources.push({
          type: resolved.type,
          id: resolved.id,
          title: resolved.title,
          manual: true,
          addedAt: now,
          sourceUpdatedAt: resolved.updatedAt,
        });
      }
    }

    await ctx.db.patch(args.artifactId, {
      sources,
      updatedAt: now,
    });

    return sources;
  },
});

export const checkStaleness = query({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    await verifyProjectAccess(ctx, artifact.projectId);

    let status: ArtifactStaleness = "fresh";
    const sources = await Promise.all(
      artifact.sources.map(async (source) => {
        const resolved = await resolveSource(ctx, artifact.projectId, source.type, source.id, false);
        if (!resolved) {
          status = "missing";
          return { ...source, status: "missing" as const };
        }

        if (source.sourceUpdatedAt && resolved.updatedAt > source.sourceUpdatedAt) {
          if (status !== "missing") status = "stale";
          return { ...source, status: "stale" as const };
        }

        return { ...source, status: "fresh" as const };
      })
    );

    return { status, sources };
  },
});

export const list = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { projectId, type, status, limit } = args;
    await verifyProjectAccess(ctx, projectId);

    if (type) {
      return ctx.db
        .query("artifacts")
        .withIndex("by_project_type", (q) => q.eq("projectId", projectId).eq("type", type))
        .order("desc")
        .take(limit ?? 50);
    }

    if (status) {
      return ctx.db
        .query("artifacts")
        .withIndex("by_project_status", (q) => q.eq("projectId", projectId).eq("status", status))
        .order("desc")
        .take(limit ?? 50);
    }

    return ctx.db
      .query("artifacts")
      .withIndex("by_project_updatedAt", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(limit ?? 50);
  },
});

type AuthCtx = QueryCtx | MutationCtx;

async function resolveSource(
  ctx: AuthCtx,
  projectId: Id<"projects">,
  type: string,
  id: string,
  requireMatch = true
): Promise<{ type: "document" | "entity" | "memory"; id: string; title?: string; updatedAt: number } | null> {
  if (type === "document") {
    const doc = await ctx.db.get(id as Id<"documents">);
    if (!doc || doc.projectId !== projectId) {
      if (requireMatch) throw new Error("Document not found");
      return null;
    }
    return { type: "document", id, title: doc.title ?? "Untitled", updatedAt: doc.updatedAt };
  }

  if (type === "entity") {
    const entity = await ctx.db.get(id as Id<"entities">);
    if (!entity || entity.projectId !== projectId) {
      if (requireMatch) throw new Error("Entity not found");
      return null;
    }
    return { type: "entity", id, title: entity.name, updatedAt: entity.updatedAt };
  }

  if (type === "memory") {
    const memory = await ctx.db.get(id as Id<"memories">);
    if (!memory || memory.projectId !== projectId) {
      if (requireMatch) throw new Error("Memory not found");
      return null;
    }
    return { type: "memory", id, title: memory.text, updatedAt: memory.updatedAt };
  }

  if (requireMatch) {
    throw new Error("Unsupported source type");
  }

  return null;
}
