import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { getServerWidgetDef } from "./registry";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterResponse {
  choices: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export const runWidgetToStream = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    widgetId: v.string(),
    documentId: v.optional(v.id("documents")),
    selectionText: v.optional(v.string()),
    selectionRange: v.optional(v.object({ from: v.number(), to: v.number() })),
    parameters: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const widget = getServerWidgetDef(args.widgetId);
    const now = Date.now();

    const document = args.documentId
      ? await ctx.db.get(args.documentId as Id<"documents">)
      : null;

    if (document && document.projectId !== args.projectId) {
      await failStream(ctx, args.streamId, "Document does not belong to project");
      return;
    }

    if (widget.requiresSelection && !args.selectionText) {
      await failStream(ctx, args.streamId, "Selection required");
      return;
    }

    const sources = document
      ? [
          {
            type: "document" as const,
            id: document._id,
            title: document.title ?? "Untitled",
            manual: false,
            addedAt: now,
            sourceUpdatedAt: document.updatedAt,
          },
        ]
      : [];

    const executionId = await ctx.db.insert("widgetExecutions", {
      projectId: args.projectId,
      userId: args.userId,
      widgetId: widget.id,
      widgetVersion: widget.version,
      widgetType: widget.widgetType,
      documentId: args.documentId,
      selectionText: args.selectionText,
      selectionRange: args.selectionRange,
      parameters: args.parameters,
      status: "gathering",
      model: widget.defaultModel,
      output: undefined,
      sources,
      error: undefined,
      startedAt: now,
      completedAt: undefined,
    });

    await appendStreamChunk(ctx, args.streamId, {
      type: "context",
      content: "",
      data: { stage: "gathering" },
    });

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      await ctx.db.patch(executionId, { status: "error", error: "OPENROUTER_API_KEY not configured" });
      await failStream(ctx, args.streamId, "OPENROUTER_API_KEY not configured");
      return;
    }

    const promptVars = buildPromptVars({
      selection: args.selectionText,
      document: document?.contentText ?? "",
      documentTitle: document?.title ?? "",
      parameters: args.parameters,
    });

    const systemPrompt = renderPrompt(widget.prompt.system, promptVars);
    const userPrompt = renderPrompt(widget.prompt.user, promptVars);

    await appendStreamChunk(ctx, args.streamId, {
      type: "context",
      content: "",
      data: { stage: "generating" },
    });

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
          "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
        },
        body: JSON.stringify({
          model: widget.defaultModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OpenRouterResponse;
      const content = data.choices[0]?.message?.content ?? "";

      await appendStreamChunk(ctx, args.streamId, {
        type: "context",
        content: "",
        data: { stage: "formatting" },
      });

      await appendStreamChunk(ctx, args.streamId, {
        type: "delta",
        content,
      });

      await ctx.db.patch(executionId, {
        status: "preview",
        output: content,
        completedAt: Date.now(),
      });

      const titleSuggestion = buildTitleSuggestion(widget, document?.title ?? null);
      const manifestDraft = widget.widgetType === "artifact"
        ? {
            type: widget.artifactType ?? "document",
            status: "draft" as const,
            sources,
            createdBy: args.userId,
            createdAt: now,
            executionContext: {
              widgetId: widget.id,
              widgetVersion: widget.version,
              model: widget.defaultModel,
              inputs: {
                documentId: args.documentId,
                selectionText: args.selectionText,
                selectionRange: args.selectionRange,
                parameters: args.parameters,
              },
              startedAt: now,
              completedAt: Date.now(),
            },
          }
        : null;

      await appendStreamChunk(ctx, args.streamId, {
        type: "context",
        content: "",
        data: {
          stage: "preview",
          result: {
            executionId,
            widgetType: widget.widgetType,
            titleSuggestion,
            manifestDraft,
          },
        },
      });

      await ctx.runMutation((internal as any)["ai/streams"].complete, {
        streamId: args.streamId,
        result: { executionId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Widget generation failed";
      await ctx.db.patch(executionId, { status: "error", error: message });
      await failStream(ctx, args.streamId, message);
    }
  },
});

async function appendStreamChunk(
  ctx: ActionCtx,
  streamId: string,
  chunk: {
    type: string;
    content: string;
    data?: unknown;
  }
) {
  await ctx.runMutation((internal as any)["ai/streams"].appendChunk, {
    streamId,
    chunk,
  });
}

async function failStream(
  ctx: ActionCtx,
  streamId: string,
  message: string
) {
  await ctx.runMutation((internal as any)["ai/streams"].fail, {
    streamId,
    error: message,
  });
}

function buildPromptVars(params: {
  selection?: string;
  document?: string;
  documentTitle?: string;
  parameters?: Record<string, unknown> | null;
}): Record<string, string> {
  const vars: Record<string, string> = {
    selection: params.selection ?? "",
    document: params.document ?? "",
    documentTitle: params.documentTitle ?? "",
    prompt: "",
    tone: "formal",
  };

  if (params.parameters && typeof params.parameters === "object") {
    for (const [key, value] of Object.entries(params.parameters)) {
      vars[key] = value === undefined || value === null ? "" : String(value);
    }
  }

  return vars;
}

function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function buildTitleSuggestion(widget: { widgetType: string; artifactType?: string }, documentTitle: string | null): string | undefined {
  if (widget.widgetType !== "artifact") return undefined;
  const date = new Date().toISOString().slice(0, 10);
  const labelMap: Record<string, string> = {
    spec: "Spec",
    summary: "Summary",
    brief: "Brief",
    notes: "Notes",
    "release-notes": "Release Notes",
  };
  const label = widget.artifactType ? labelMap[widget.artifactType] ?? "Artifact" : "Artifact";
  if (documentTitle && documentTitle.trim().length > 0) {
    return `${label} - ${documentTitle}`;
  }
  return `${label} - ${date}`;
}
