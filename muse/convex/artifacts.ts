import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyProjectEditor } from "./lib/auth";
import { parseArtifactEnvelope } from "../packages/core/src/schema/artifact.schema";
import { applyJsonPatch, compileArtifactOp, type ArtifactOp } from "../packages/core/src/artifacts/engine";

export type ArtifactStaleness = "fresh" | "stale" | "missing" | "external";

type ArtifactFormat = "markdown" | "json" | "plain";
export type ArtifactStatus = "draft" | "manually_modified" | "applied" | "saved";

const artifactSourceValidator = v.object({
  type: v.union(
    v.literal("document"),
    v.literal("entity"),
    v.literal("memory"),
    v.literal("web"),
    v.literal("github")
  ),
  id: v.string(),
  title: v.optional(v.string()),
  manual: v.boolean(),
  addedAt: v.number(),
  sourceUpdatedAt: v.optional(v.number()),
});

const executionContextValidator = v.object({
  widgetId: v.string(),
  widgetVersion: v.string(),
  model: v.string(),
  inputs: v.any(),
  startedAt: v.number(),
  completedAt: v.number(),
});

const artifactStatusValidator = v.union(
  v.literal("draft"),
  v.literal("manually_modified"),
  v.literal("applied"),
  v.literal("saved")
);

const artifactStatusContextValidator = v.object({
  appliedToDocumentId: v.optional(v.id("documents")),
  savedToEntityId: v.optional(v.id("entities")),
});

const ALLOWED_STATUS_TRANSITIONS: Record<ArtifactStatus, readonly ArtifactStatus[]> = {
  draft: ["manually_modified", "applied", "saved"],
  manually_modified: ["applied", "saved"],
  applied: ["saved"],
  saved: [],
};

function assertValidArtifactStatusTransition(from: ArtifactStatus, to: ArtifactStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
  if (allowed.includes(to)) return;
  throw new Error(`Invalid artifact status transition: ${from} -> ${to}`);
}

function inferArtifactFormat(content: string): ArtifactFormat {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return "markdown";
  try {
    const parsed = JSON.parse(trimmed);
    parseArtifactEnvelope(parsed);
    return "json";
  } catch {
    return "markdown";
  }
}

function validateArtifactContent(format: ArtifactFormat, content: string): void {
  if (format !== "json") return;
  const parsed = JSON.parse(content) as unknown;
  parseArtifactEnvelope(parsed);
}

function buildExecutionArtifactKey(executionId: string): string {
  return `artifact-${executionId}`;
}

async function getArtifactByKey(
  ctx: AuthCtx,
  projectId: Id<"projects">,
  artifactKey: string
): Promise<any | null> {
  const byKey = await ctx.db
    .query("artifacts")
    .withIndex("by_project_artifactKey", (q) =>
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

export const createFromExecution = mutation({
  args: {
    projectId: v.id("projects"),
    executionId: v.id("widgetExecutions"),
    title: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const { projectId, executionId, title, type } = args;
    const userId = await verifyProjectEditor(ctx, projectId);

    const execution = await ctx.db.get(executionId);
    if (!execution || execution.projectId !== projectId) {
      throw new Error("Widget execution not found");
    }

    if (!execution.output) {
      throw new Error("Widget output missing");
    }

    const artifactKey = buildExecutionArtifactKey(executionId);
    const existing = await getArtifactByKey(ctx, projectId, artifactKey);
    if (existing) {
      return { artifactId: existing._id, artifactKey };
    }

    const now = Date.now();
    const format = inferArtifactFormat(execution.output);
    validateArtifactContent(format, execution.output);
    const artifactId = await ctx.db.insert("artifacts", {
      projectId,
      artifactKey,
      createdBy: userId,
      type,
      status: "draft",
      statusChangedAt: now,
      statusBy: userId,
      title,
      format,
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
      artifactKey,
      version: 1,
      format,
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

    return { artifactId, artifactKey };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    artifactKey: v.string(),
    type: v.string(),
    title: v.string(),
    format: v.union(v.literal("markdown"), v.literal("json"), v.literal("plain")),
    content: v.string(),
    sources: v.optional(v.array(artifactSourceValidator)),
    executionContext: executionContextValidator,
  },
  handler: async (ctx, args) => {
    const userId = await verifyProjectEditor(ctx, args.projectId);

    const existing = await ctx.db
      .query("artifacts")
      .withIndex("by_project_artifactKey", (q) =>
        q.eq("projectId", args.projectId).eq("artifactKey", args.artifactKey)
      )
      .first();
    if (existing) {
      throw new Error("Artifact key already exists");
    }

    validateArtifactContent(args.format, args.content);

    const now = Date.now();
    const artifactId = await ctx.db.insert("artifacts", {
      projectId: args.projectId,
      artifactKey: args.artifactKey,
      createdBy: userId,
      type: args.type,
      status: "draft",
      statusChangedAt: now,
      statusBy: userId,
      title: args.title,
      format: args.format,
      content: args.content,
      sources: args.sources ?? [],
      executionContext: args.executionContext,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("artifactVersions", {
      projectId: args.projectId,
      artifactId,
      artifactKey: args.artifactKey,
      version: 1,
      format: args.format,
      content: args.content,
      sources: args.sources ?? [],
      executionContext: args.executionContext,
      createdAt: now,
    });

    return { artifactId, artifactKey: args.artifactKey, version: 1 };
  },
});

export const updateContent = mutation({
  args: {
    projectId: v.id("projects"),
    artifactKey: v.string(),
    content: v.string(),
    format: v.optional(v.union(v.literal("markdown"), v.literal("json"), v.literal("plain"))),
    sources: v.optional(v.array(artifactSourceValidator)),
    executionContext: v.optional(executionContextValidator),
  },
  handler: async (ctx, args) => {
    const userId = await verifyProjectEditor(ctx, args.projectId);

    const artifact = await getArtifactByKey(ctx, args.projectId, args.artifactKey);
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    if (artifact.status === "applied") {
      throw new Error("Artifact already applied");
    }
    if (artifact.status === "saved") {
      throw new Error("Artifact already saved");
    }

    const format = args.format ?? artifact.format ?? inferArtifactFormat(args.content);
    validateArtifactContent(format, args.content);

    const latestVersion = await ctx.db
      .query("artifactVersions")
      .withIndex("by_artifact_version", (q) => q.eq("artifactId", artifact._id))
      .order("desc")
      .first();
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const now = Date.now();
    const sources = args.sources ?? artifact.sources;
    const executionContext = args.executionContext ?? artifact.executionContext;

    const patch: Record<string, unknown> = {
      content: args.content,
      format,
      sources,
      executionContext,
      statusContext: {},
      updatedAt: now,
    };

    if (artifact.status === "draft") {
      assertValidArtifactStatusTransition("draft", "manually_modified");
      patch["status"] = "manually_modified";
      patch["statusChangedAt"] = now;
      patch["statusBy"] = userId;
    }

    await ctx.db.patch(artifact._id, patch);

    await ctx.db.insert("artifactVersions", {
      projectId: args.projectId,
      artifactId: artifact._id,
      artifactKey: args.artifactKey,
      version: nextVersion,
      format,
      content: args.content,
      sources,
      executionContext,
      createdAt: now,
    });

    return { artifactKey: args.artifactKey, version: nextVersion, updatedAt: now };
  },
});

export const setStatus = mutation({
  args: {
    projectId: v.id("projects"),
    artifactKey: v.string(),
    status: artifactStatusValidator,
    context: v.optional(artifactStatusContextValidator),
  },
  handler: async (ctx, args) => {
    const userId = await verifyProjectEditor(ctx, args.projectId);

    const artifact = await getArtifactByKey(ctx, args.projectId, args.artifactKey);
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    const fromStatus = artifact.status as ArtifactStatus;
    const toStatus = args.status as ArtifactStatus;
    assertValidArtifactStatusTransition(fromStatus, toStatus);

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: toStatus,
      statusChangedAt: now,
      statusBy: userId,
      updatedAt: now,
    };

    if (toStatus === "applied" || toStatus === "saved") {
      patch["statusContext"] = args.context ?? {};
    } else {
      patch["statusContext"] = {};
    }

    await ctx.db.patch(artifact._id, patch);
    return { artifactKey: args.artifactKey, status: toStatus, statusChangedAt: now };
  },
});

export const appendMessage = mutation({
  args: {
    projectId: v.id("projects"),
    artifactKey: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await verifyProjectEditor(ctx, args.projectId);

    const artifact = await getArtifactByKey(ctx, args.projectId, args.artifactKey);
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("artifactMessages", {
      projectId: args.projectId,
      artifactId: artifact._id,
      artifactKey: args.artifactKey,
      role: args.role,
      content: args.content,
      createdAt: now,
      context: args.context,
    });

    await ctx.db.patch(artifact._id, { updatedAt: now });

    return messageId;
  },
});

export const applyOp = mutation({
  args: {
    projectId: v.id("projects"),
    artifactKey: v.string(),
    op: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await verifyProjectEditor(ctx, args.projectId);

    const artifact = await getArtifactByKey(ctx, args.projectId, args.artifactKey);
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    if (artifact.status === "applied") {
      throw new Error("Artifact already applied");
    }
    if (artifact.status === "saved") {
      throw new Error("Artifact already saved");
    }

    const envelope = parseArtifactEnvelope(JSON.parse(artifact.content));
    const patch = compileArtifactOp(envelope, args.op as ArtifactOp);
    const nextEnvelope = applyJsonPatch(envelope, patch.patch);
    const nextContent = JSON.stringify(nextEnvelope, null, 2);
    const now = Date.now();

    const opId = await ctx.db.insert("artifactOps", {
      projectId: args.projectId,
      artifactId: artifact._id,
      artifactKey: args.artifactKey,
      baseRev: patch.baseRev,
      nextRev: nextEnvelope.rev,
      op: args.op,
      patch: patch.patch,
      createdAt: now,
      createdBy: userId,
    });

    const artifactPatch: Record<string, unknown> = {
      content: nextContent,
      format: "json",
      statusContext: {},
      updatedAt: now,
    };

    if (artifact.status === "draft") {
      assertValidArtifactStatusTransition("draft", "manually_modified");
      artifactPatch["status"] = "manually_modified";
      artifactPatch["statusChangedAt"] = now;
      artifactPatch["statusBy"] = userId;
    }

    await ctx.db.patch(artifact._id, artifactPatch);

    return {
      nextEnvelope,
      logEntry: {
        id: opId,
        artifactId: args.artifactKey,
        baseRev: patch.baseRev,
        nextRev: nextEnvelope.rev,
        op: args.op as ArtifactOp,
        patch: patch.patch,
        createdAt: now,
      },
    };
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
        if (!resolved) continue;
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
        // External sources (web/github) can't be tracked for staleness
        if (source.type === "web" || source.type === "github") {
          return { ...source, status: "external" as const };
        }

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

export const getByKey = query({
  args: {
    projectId: v.id("projects"),
    artifactKey: v.string(),
    messageLimit: v.optional(v.number()),
    messageCursor: v.optional(v.string()),
    versionLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const artifact = await getArtifactByKey(ctx, args.projectId, args.artifactKey);
    if (!artifact) return null;

    const versionLimit = args.versionLimit ?? 50;
    const messageLimit = args.messageLimit ?? 200;

    const versions = await ctx.db
      .query("artifactVersions")
      .withIndex("by_artifact_version", (q) => q.eq("artifactId", artifact._id))
      .order("desc")
      .take(versionLimit);

    const ops = await ctx.db
      .query("artifactOps")
      .withIndex("by_artifact_createdAt", (q) => q.eq("artifactId", artifact._id))
      .order("asc")
      .take(500);

    const cursorValue = args.messageCursor ? Number(args.messageCursor) : undefined;
    const messageQuery = ctx.db
      .query("artifactMessages")
      .withIndex("by_artifact_createdAt", (q) =>
        cursorValue
          ? q.eq("artifactId", artifact._id).gt("createdAt", cursorValue)
          : q.eq("artifactId", artifact._id)
      )
      .order("asc");
    const messages = await messageQuery.take(messageLimit);
    const nextCursor =
      messages.length === messageLimit
        ? String(messages[messages.length - 1]?.createdAt ?? "")
        : undefined;

    let stalenessStatus: ArtifactStaleness = "fresh";
    const stalenessSources = await Promise.all(
      artifact.sources.map(async (source: any) => {
        if (source.type === "web" || source.type === "github") {
          return { ...source, status: "external" as const };
        }

        const resolved = await resolveSource(
          ctx,
          artifact.projectId,
          source.type,
          source.id,
          false
        );
        if (!resolved) {
          stalenessStatus = "missing";
          return { ...source, status: "missing" as const };
        }

        if (source.sourceUpdatedAt && resolved.updatedAt > source.sourceUpdatedAt) {
          if (stalenessStatus !== "missing") stalenessStatus = "stale";
          return { ...source, status: "stale" as const };
        }

        return { ...source, status: "fresh" as const };
      })
    );

    return {
      artifact,
      versions,
      ops,
      messages,
      nextMessageCursor: nextCursor,
      staleness: { status: stalenessStatus, sources: stalenessSources },
    };
  },
});

export const list = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(v.string()),
    status: v.optional(artifactStatusValidator),
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

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const limit = args.limit ?? 50;
    const cursorValue = args.cursor ? Number(args.cursor) : undefined;

    const query = ctx.db
      .query("artifacts")
      .withIndex("by_project_updatedAt", (q) =>
        cursorValue
          ? q.eq("projectId", args.projectId).lt("updatedAt", cursorValue)
          : q.eq("projectId", args.projectId)
      )
      .order("desc");

    const artifacts = await query.take(limit);
    const nextCursor =
      artifacts.length === limit
        ? String(artifacts[artifacts.length - 1]?.updatedAt ?? "")
        : undefined;

    return { artifacts, nextCursor };
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
