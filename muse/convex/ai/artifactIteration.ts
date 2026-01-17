/**
 * Artifact iteration action
 *
 * Runs a lightweight OpenRouter call to refine an existing artifact and persist:
 * - user + assistant messages (artifactMessages)
 * - updated artifact content + version (artifacts.updateContent)
 */

"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { parseArtifactEnvelope, type ArtifactEnvelopeByType } from "../../packages/core/src/schema/artifact.schema";

type ArtifactFormat = "markdown" | "json" | "plain";

type IterationEditorContext = {
  documentId?: Id<"documents">;
  documentTitle?: string;
  selectionText?: string;
};

type IterationModelResponse = {
  assistantMessage: string;
  nextContent?: string;
  nextTitle?: string;
  nextDescription?: string;
  nextData?: unknown;
};

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const MOCK_MODE = process.env["E2E_MOCK_AI"] === "true" || process.env["SAGA_TEST_MODE"] === "true";

async function callOpenRouterJson<T>(params: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}): Promise<T> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://rhei.team",
      "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Rhei",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return JSON.parse(content) as T;
}

function resolveArtifactFormat(raw: unknown): ArtifactFormat {
  if (raw === "json") return "json";
  if (raw === "plain") return "plain";
  return "markdown";
}

function formatConversationHistory(
  messages: Array<{ role: string; content: string }> | undefined,
  limit: number
): string {
  if (!messages || messages.length === 0) return "None.";
  const slice = messages.slice(-limit);
  return slice.map((m) => `[${m.role}] ${m.content}`).join("\n");
}

function buildSystemPrompt(format: ArtifactFormat): string {
  if (format === "json") {
    return [
      "You refine an existing Mythos artifact.",
      "",
      "Return a JSON object with:",
      `- assistantMessage: string (short, 1-2 sentences, no markdown)`,
      `- nextData: object (the FULL updated artifact data payload)`,
      "- nextTitle?: string (optional)",
      "- nextDescription?: string (optional)",
      "",
      "Rules:",
      "- Do NOT wrap JSON in markdown fences.",
      "- Do NOT change artifactId, schemaVersion, or type (the server will preserve them).",
      "- Keep the data shape compatible with the current artifact type.",
    ].join("\n");
  }

  return [
    "You refine an existing Mythos artifact.",
    "",
    "Return a JSON object with:",
    `- assistantMessage: string (short, 1-2 sentences, no markdown)`,
    `- nextContent: string (the FULL updated artifact content)`,
    "",
    "Rules:",
    "- Do NOT wrap content in markdown fences unless the content itself must contain fences.",
    "- Preserve the artifact's general style and structure unless the user asks otherwise.",
  ].join("\n");
}

function buildUserPrompt(params: {
  artifact: { title: string; type: string; format: ArtifactFormat; content: string; status: string };
  envelope: ArtifactEnvelopeByType | null;
  conversationHistory: string;
  userMessage: string;
  editorContext?: IterationEditorContext;
}): string {
  const contextLines: string[] = [];
  if (params.editorContext?.documentTitle) {
    contextLines.push(`Document: ${params.editorContext.documentTitle}`);
  }
  if (params.editorContext?.selectionText) {
    contextLines.push(`Selection: ${params.editorContext.selectionText}`);
  }

  const contextBlock = contextLines.length > 0 ? contextLines.join("\n") : "None.";

  if (params.artifact.format === "json" && params.envelope) {
    return [
      `Artifact title: ${params.artifact.title}`,
      `Artifact type: ${params.envelope.type}`,
      `Artifact status: ${params.artifact.status}`,
      "",
      "Editor context:",
      contextBlock,
      "",
      "Conversation history (most recent last):",
      params.conversationHistory,
      "",
      "Current artifact data (JSON):",
      JSON.stringify(params.envelope.data, null, 2),
      "",
      "User request:",
      params.userMessage,
    ].join("\n");
  }

  return [
    `Artifact title: ${params.artifact.title}`,
    `Artifact type: ${params.artifact.type}`,
    `Artifact format: ${params.artifact.format}`,
    `Artifact status: ${params.artifact.status}`,
    "",
    "Editor context:",
    contextBlock,
    "",
    "Conversation history (most recent last):",
    params.conversationHistory,
    "",
    "Current artifact content:",
    params.artifact.content,
    "",
    "User request:",
    params.userMessage,
  ].join("\n");
}

function buildMockResult(params: {
  format: ArtifactFormat;
  envelope: ArtifactEnvelopeByType | null;
  currentContent: string;
  userMessage: string;
}): { assistantMessage: string; nextContent: string; nextFormat: ArtifactFormat } {
  const assistantMessage = "Mock: updated the artifact based on your feedback.";

  if (params.format === "json" && params.envelope) {
    const nowIso = new Date().toISOString();
    const nextEnvelope = parseArtifactEnvelope({
      ...params.envelope,
      rev: params.envelope.rev + 1,
      updatedAt: nowIso,
    });
    return {
      assistantMessage,
      nextFormat: "json",
      nextContent: JSON.stringify(nextEnvelope, null, 2),
    };
  }

  const suffix = `\n\n[Mock iteration]\n${params.userMessage}\n`;
  return {
    assistantMessage,
    nextFormat: params.format,
    nextContent: `${params.currentContent}${suffix}`,
  };
}

export const iterateArtifact = action({
  args: {
    projectId: v.id("projects"),
    artifactKey: v.string(),
    userMessage: v.string(),
    editorContext: v.optional(
      v.object({
        documentId: v.optional(v.id("documents")),
        documentTitle: v.optional(v.string()),
        selectionText: v.optional(v.string()),
      })
    ),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const apiAny: any = api;
    // @ts-expect-error Convex internal API type is too deep for TS in this file.
    const internalAny: any = internal;

    const isEditor = await (ctx.runQuery as any)(
      internalAny.collaboration.isProjectEditor,
      { projectId: args.projectId, userId: identity.subject }
    );
    if (!isEditor) {
      throw new Error("Edit access denied");
    }

    const trimmedMessage = args.userMessage.trim();
    if (!trimmedMessage) {
      throw new Error("Empty message");
    }

    const startedAt = Date.now();
    const artifactResult = (await (ctx.runQuery as any)(apiAny.artifacts.getByKey, {
      projectId: args.projectId,
      artifactKey: args.artifactKey,
      messageLimit: 50,
      versionLimit: 1,
    })) as
      | {
          artifact: { title: string; type: string; content: string; format?: ArtifactFormat; status: string };
          messages?: Array<{ role: string; content: string }>;
        }
      | null;

    if (!artifactResult?.artifact) {
      throw new Error("Artifact not found");
    }

    const artifact = artifactResult.artifact;
    const format = resolveArtifactFormat(artifact.format);

    let envelope: ArtifactEnvelopeByType | null = null;
    if (format === "json") {
      envelope = parseArtifactEnvelope(JSON.parse(artifact.content));
    }

    const conversationHistory = formatConversationHistory(artifactResult.messages, 20);

    const editorContext: IterationEditorContext | undefined = args.editorContext
      ? {
          documentId: args.editorContext.documentId,
          documentTitle: args.editorContext.documentTitle,
          selectionText: args.editorContext.selectionText,
        }
      : undefined;

    await ctx.runMutation(apiAny.artifacts.appendMessage, {
      projectId: args.projectId,
      artifactKey: args.artifactKey,
      role: "user",
      content: trimmedMessage,
      context: editorContext,
    });

    let assistantMessage: string;
    let nextContent: string;
    let nextFormat: ArtifactFormat = format;

    if (MOCK_MODE) {
      const mock = buildMockResult({
        format,
        envelope,
        currentContent: artifact.content,
        userMessage: trimmedMessage,
      });
      assistantMessage = mock.assistantMessage;
      nextContent = mock.nextContent;
      nextFormat = mock.nextFormat;
    } else {
      const model = args.model ?? DEFAULT_MODEL;
      const system = buildSystemPrompt(format);
      const user = buildUserPrompt({
        artifact: {
          title: artifact.title,
          type: artifact.type,
          format,
          content: artifact.content,
          status: artifact.status,
        },
        envelope,
        conversationHistory,
        userMessage: trimmedMessage,
        editorContext,
      });

      const response = await callOpenRouterJson<IterationModelResponse>({
        model,
        system,
        user,
        maxTokens: 2500,
        temperature: 0.3,
      });

      if (!response || typeof response.assistantMessage !== "string") {
        throw new Error("Model response missing assistantMessage");
      }
      assistantMessage = response.assistantMessage;

      if (format === "json") {
        if (!envelope) {
          throw new Error("Artifact envelope missing");
        }
        if (response.nextData === undefined) {
          throw new Error("Model response missing nextData");
        }

        const nowIso = new Date().toISOString();
        const nextEnvelope = parseArtifactEnvelope({
          ...envelope,
          title: typeof response.nextTitle === "string" ? response.nextTitle : envelope.title,
          description:
            typeof response.nextDescription === "string"
              ? response.nextDescription
              : envelope.description,
          rev: envelope.rev + 1,
          updatedAt: nowIso,
          data: response.nextData,
        });

        nextFormat = "json";
        nextContent = JSON.stringify(nextEnvelope, null, 2);
      } else {
        if (typeof response.nextContent !== "string") {
          throw new Error("Model response missing nextContent");
        }
        nextContent = response.nextContent;
      }
    }

    const completedAt = Date.now();
    const updateResult = await ctx.runMutation(apiAny.artifacts.updateContent, {
      projectId: args.projectId,
      artifactKey: args.artifactKey,
      content: nextContent,
      format: nextFormat,
      executionContext: {
        widgetId: "artifact_iteration",
        widgetVersion: "v1",
        model: args.model ?? DEFAULT_MODEL,
        inputs: {
          userMessage: trimmedMessage,
          editorContext,
        },
        startedAt,
        completedAt,
      },
    });

    await ctx.runMutation(apiAny.artifacts.appendMessage, {
      projectId: args.projectId,
      artifactKey: args.artifactKey,
      role: "assistant",
      content: assistantMessage,
      context: editorContext,
    });

    return {
      assistantMessage,
      nextContent,
      nextFormat,
      version: updateResult?.version,
      updatedAt: updateResult?.updatedAt,
    };
  },
});
