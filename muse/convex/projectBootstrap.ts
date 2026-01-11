/**
 * Project bootstrap
 *
 * Creates a project with its initial documents and optional genesis persistence.
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "./lib/auth";

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const PROJECT_SEED_TITLE = "World Seed";
const WORLD_SEED_TYPE = "worldbuilding";

type SeedSource =
  | {
      kind: "blank";
      projectName: string;
      projectDescription?: string;
      genre?: string;
      genesisPrompt?: string;
    }
  | {
      kind: "template";
      projectName: string;
      projectDescription?: string;
      templateId: string;
      templateName: string;
      templateDescription: string;
      entityKinds?: string[];
      relationshipKinds?: string[];
      genre?: string;
    };

function buildSeedLines(source: SeedSource): string[] {
  const lines: string[] = [];

  lines.push(`Project: ${source.projectName}`);

  if (source.genre) {
    lines.push(`Genre: ${source.genre}`);
  }

  if (source.projectDescription) {
    lines.push(`Description: ${source.projectDescription}`);
  }

  if (source.kind === "blank") {
    if (source.genesisPrompt) {
      lines.push(`World concept: ${source.genesisPrompt}`);
    }
    return lines;
  }

  lines.push(`Template: ${source.templateName} (${source.templateId})`);
  lines.push(`Template description: ${source.templateDescription}`);

  if (source.entityKinds && source.entityKinds.length > 0) {
    lines.push(`Entity kinds: ${source.entityKinds.join(", ")}`);
  }

  if (source.relationshipKinds && source.relationshipKinds.length > 0) {
    lines.push(`Relationship kinds: ${source.relationshipKinds.join(", ")}`);
  }

  return lines;
}

function buildTiptapDoc(lines: string[]): Record<string, unknown> {
  if (lines.length === 0) {
    return EMPTY_TIPTAP_DOC;
  }

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export const bootstrap = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    genre: v.optional(v.string()),
    templateId: v.optional(v.string()),
    templateOverrides: v.optional(v.any()),
    initialDocumentType: v.optional(v.string()),
    initialDocumentTitle: v.optional(v.string()),
    seed: v.optional(
      v.union(
        v.object({
          kind: v.literal("blank"),
          projectName: v.string(),
          projectDescription: v.optional(v.string()),
          genre: v.optional(v.string()),
          genesisPrompt: v.optional(v.string()),
        }),
        v.object({
          kind: v.literal("template"),
          projectName: v.string(),
          projectDescription: v.optional(v.string()),
          templateId: v.string(),
          templateName: v.string(),
          templateDescription: v.string(),
          entityKinds: v.optional(v.array(v.string())),
          relationshipKinds: v.optional(v.array(v.string())),
          genre: v.optional(v.string()),
        })
      )
    ),
    templateEntityKinds: v.optional(v.array(v.any())),
    templateRelationshipKinds: v.optional(v.array(v.any())),
    genesis: v.optional(
      v.object({
        prompt: v.string(),
        entityCount: v.optional(v.number()),
        detailLevel: v.optional(
          v.union(v.literal("minimal"), v.literal("standard"), v.literal("detailed"))
        ),
        includeOutline: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      ownerId: userId,
      name: args.name,
      description: args.description,
      genre: args.genre,
      templateId: args.templateId,
      templateOverrides: args.templateOverrides,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.collaboration.addProjectMemberInternal, {
      projectId,
      userId,
      role: "owner",
    });

    // Initial document
    const initialDocumentId = await ctx.db.insert("documents", {
      projectId,
      type: args.initialDocumentType ?? "chapter",
      title: args.initialDocumentTitle ?? "Chapter 1",
      content: EMPTY_TIPTAP_DOC,
      contentText: "",
      parentId: undefined,
      orderIndex: 0,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
      projectId,
      targetType: "document",
      targetId: initialDocumentId,
    });

    let seedDocumentId: Id<"documents"> | null = null;
    let seedContentText: string | null = null;

    if (args.seed) {
      const lines = buildSeedLines(args.seed as SeedSource);
      seedContentText = lines.join("\n");
      const content = buildTiptapDoc(lines);
      const wordCount = countWords(seedContentText);

      seedDocumentId = await ctx.db.insert("documents", {
        projectId,
        type: WORLD_SEED_TYPE,
        title: PROJECT_SEED_TITLE,
        content,
        contentText: seedContentText,
        parentId: undefined,
        orderIndex: 1,
        wordCount,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
        projectId,
        targetType: "document",
        targetId: seedDocumentId,
      });
    }

    if (args.templateEntityKinds || args.templateRelationshipKinds) {
      const entityTypes = (args.templateEntityKinds ?? []).map((kind: any) => ({
        type: String(kind.kind),
        displayName: String(kind.label),
        schema: kind,
        icon: kind.icon ? String(kind.icon) : undefined,
        color: kind.color ? String(kind.color) : undefined,
      }));

      const relationshipTypes = (args.templateRelationshipKinds ?? []).map((kind: any) => ({
        type: String(kind.kind),
        displayName: String(kind.label),
        schema: kind,
      }));

      await ctx.db.insert("projectTypeRegistry", {
        projectId,
        entityTypes,
        relationshipTypes,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Schedule genesis work asynchronously if requested
    // Note: Mutations cannot call actions directly, so genesis runs in background
    if (args.genesis?.prompt) {
      await ctx.scheduler.runAfter(0, (internal as any)["ai/genesis"].runGenesisAndPersist, {
        projectId,
        prompt: args.genesis.prompt,
        genre: args.genre,
        entityCount: args.genesis.entityCount,
        detailLevel: args.genesis.detailLevel,
        includeOutline: args.genesis.includeOutline ?? true,
        seedDocumentId,
      });
    }

    return {
      projectId,
      initialDocumentId,
      seedDocumentId,
      seedContentText,
      genesis: args.genesis?.prompt ? "scheduled" : null,
    };
  },
});
