/**
 * Saga Agent Runtime
 *
 * Bridges the Convex Agent component with the Saga SSE stream model.
 */

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { internal, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { Agent } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";
import { buildSystemPrompt, retrieveRAGContext, type RAGContext } from "./rag";
import { askQuestionTool, writeContentTool } from "./tools/editorTools";
import {
  searchContextTool,
  readDocumentTool,
  searchChaptersTool,
  searchWorldTool,
  getEntityTool,
} from "./tools/ragTools";
import {
  createEntityTool,
  updateEntityTool,
  createRelationshipTool,
  updateRelationshipTool,
} from "./tools/worldGraphTools";
import { createQwenEmbeddingModel } from "../lib/deepinfraEmbedding";
import { ServerAgentEvents } from "../lib/analytics";
import { needsToolApproval } from "../lib/approvalConfig";

const AI_PRESENCE_ROOM_PREFIXES = {
  project: "project",
  document: "document",
};

function resolveEditorDocumentId(editorContext: unknown): string | undefined {
  if (!editorContext || typeof editorContext !== "object") return undefined;
  const maybe = (editorContext as { documentId?: unknown }).documentId;
  return typeof maybe === "string" && maybe.length > 0 ? maybe : undefined;
}

async function setAiPresence(
  ctx: ActionCtx,
  projectId: string,
  documentId: string | undefined,
  isTyping: boolean
) {
  if (!documentId) return;

  const roomIds = [
    `${AI_PRESENCE_ROOM_PREFIXES.document}:${documentId}`,
    `${AI_PRESENCE_ROOM_PREFIXES.project}:${projectId}`,
  ];

  await Promise.all(
    roomIds.map((roomId) =>
      ctx.runMutation((internal as any)["presence"].setAiPresence, {
        roomId,
        documentId,
        isTyping,
      })
    )
  );
}

const AI_KEEPALIVE_INTERVAL_MS = 8_000;

async function maybeKeepAiTypingAlive(opts: {
  ctx: ActionCtx;
  projectId: string;
  presenceDocumentId?: string;
  isTemplateBuilder: boolean;
  lastAiPresenceAt: number;
}): Promise<number> {
  const { ctx, projectId, presenceDocumentId, isTemplateBuilder, lastAiPresenceAt } = opts;
  if (isTemplateBuilder || !presenceDocumentId) return lastAiPresenceAt;

  const now = Date.now();
  if (now - lastAiPresenceAt < AI_KEEPALIVE_INTERVAL_MS) return lastAiPresenceAt;

  try {
    await setAiPresence(ctx, projectId, presenceDocumentId, true);
  } catch (error) {
    console.warn("[agentRuntime] Failed to keep AI presence alive:", error);
  }

  return now;
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const LEXICAL_LIMIT = 20;
const E2E_TEST_MODE = process.env["E2E_TEST_MODE"] === "true";
const SAGA_TEST_MODE = process.env["SAGA_TEST_MODE"] === "true";
const TEST_MODE = E2E_TEST_MODE || SAGA_TEST_MODE;

const openrouter = createOpenAI({
  apiKey: process.env["OPENROUTER_API_KEY"],
  baseURL: OPENROUTER_BASE_URL,
  headers: {
    "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
    "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
  },
});

export type SagaTestStreamChunk = LanguageModelV3StreamPart;

export interface SagaTestStreamStep {
  chunks: SagaTestStreamChunk[];
}

let sagaTestScript: SagaTestStreamStep[] = [];
let _agent: Agent | null = null;

function normalizeTestChunks(chunks: SagaTestStreamChunk[]): SagaTestStreamChunk[] {
  const normalized = [...chunks];
  if (!normalized.some((chunk) => chunk.type === "stream-start")) {
    normalized.unshift({ type: "stream-start", warnings: [] });
  }
  if (!normalized.some((chunk) => chunk.type === "finish")) {
    normalized.push({
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
    });
  }
  return normalized;
}

function createTestLanguageModel() {
  const generateResult: LanguageModelV3GenerateResult = {
    content: [],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };

  const doStream = async (): Promise<LanguageModelV3StreamResult> => {
    const step = sagaTestScript.shift();
    if (!step) {
      throw new Error("No saga test script step available");
    }
    return {
      stream: simulateReadableStream<LanguageModelV3StreamPart>({
        chunks: normalizeTestChunks(step.chunks),
      }),
    };
  };

  return new MockLanguageModelV3({
    doGenerate: generateResult,
    doStream,
  });
}

function createSagaAgent() {
  const testMode = TEST_MODE;
  const languageModel = testMode ? createTestLanguageModel() : openrouter.chat(DEFAULT_MODEL);

  return new Agent(components.agent, {
    name: "Saga",
    languageModel,

    // Thread memory: vector search for similar past messages
    textEmbeddingModel: testMode ? undefined : createQwenEmbeddingModel(),
    contextOptions: testMode
      ? {
          recentMessages: 0,
          searchOptions: {
            limit: 0,
            vectorSearch: false,
            textSearch: false,
            messageRange: { before: 0, after: 0 },
          },
          searchOtherThreads: false,
        }
      : {
          recentMessages: 20,
          searchOptions: {
            limit: 10,
            vectorSearch: true,
            textSearch: true,
            messageRange: { before: 2, after: 1 },
          },
          searchOtherThreads: false,
        },

    tools: {
      ask_question: askQuestionTool,
      write_content: writeContentTool,
      search_context: searchContextTool,
      read_document: readDocumentTool,
      search_chapters: searchChaptersTool,
      search_world: searchWorldTool,
      get_entity: getEntityTool,
      create_entity: createEntityTool,
      update_entity: updateEntityTool,
      create_relationship: createRelationshipTool,
      update_relationship: updateRelationshipTool,
    },
    maxSteps: 8,
  });
}

function getSagaAgent(): Agent {
  if (!_agent) {
    _agent = createSagaAgent();
  }
  return _agent;
}

export function setSagaTestScript(steps: SagaTestStreamStep[]) {
  sagaTestScript = [...steps];
  _agent = null;
}

const autoExecuteTools = new Set([
  "search_context",
  "read_document",
  "search_chapters",
  "search_world",
  "get_entity",
]);
const worldGraphTools = new Set([
  "create_entity",
  "update_entity",
  "create_relationship",
  "update_relationship",
]);

type ToolActorContext = {
  actorType: "ai" | "user" | "system";
  actorUserId?: string;
  actorAgentId?: string;
  actorName?: string;
};

type ToolSourceContext = {
  streamId?: string;
  threadId?: string;
  toolCallId?: string;
  promptMessageId?: string;
};

type ToolApprovalType = "execution" | "input" | "apply";

type ToolApprovalDanger = "safe" | "costly" | "destructive";

function resolveApprovalType(toolName: string): ToolApprovalType {
  if (toolName === "ask_question") return "input";
  if (toolName === "write_content") return "apply";
  return "execution";
}

function resolveApprovalDanger(toolName: string, args: Record<string, unknown>): ToolApprovalDanger {
  if (toolName === "write_content") {
    const content = typeof args.content === "string" ? args.content : "";
    const operation = typeof args.operation === "string" ? args.operation : undefined;
    if (operation === "append_document" || content.length > 800) {
      return "costly";
    }
    return "safe";
  }
  if (worldGraphTools.has(toolName)) return "destructive";
  return "safe";
}

async function executeRagTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string
): Promise<unknown> {
  switch (toolName) {
    case "search_context":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeSearchContext, {
        projectId,
        query: args["query"] as string,
        scope: args["scope"] as string | undefined,
        limit: args["limit"] as number | undefined,
      });
    case "read_document":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeReadDocument, {
        projectId,
        documentId: args["documentId"] as string,
      });
    case "search_chapters":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeSearchChapters, {
        projectId,
        query: args["query"] as string,
        type: args["type"] as string | undefined,
      });
    case "search_world":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeSearchWorld, {
        projectId,
        query: args["query"] as string,
        category: args["category"] as string | undefined,
      });
    case "get_entity":
      return ctx.runAction((internal as any)["ai/tools/ragHandlers"].executeGetEntity, {
        projectId,
        entityId: args["entityId"] as string,
        includeRelationships: args["includeRelationships"] as boolean | undefined,
      });
    default:
      throw new Error(`Unknown RAG tool: ${toolName}`);
  }
}

async function executeWorldGraphTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string,
  actor?: ToolActorContext,
  source?: ToolSourceContext
): Promise<unknown> {
  switch (toolName) {
    case "create_entity":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeCreateEntity, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "update_entity":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeUpdateEntity, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "create_relationship":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeCreateRelationship, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    case "update_relationship":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeUpdateRelationship, {
        projectId,
        toolArgs: args,
        actor,
        source,
      });
    default:
      throw new Error(`Unknown world graph tool: ${toolName}`);
  }
}

async function appendStreamChunk(
  ctx: ActionCtx,
  streamId: string,
  chunk: {
    type: string;
    content: string;
    toolCallId?: string;
    toolName?: string;
    approvalId?: string;
    approvalType?: ToolApprovalType;
    danger?: ToolApprovalDanger;
    args?: unknown;
    data?: unknown;
    promptMessageId?: string;
  }
) {
  await ctx.runMutation((internal as any)["ai/streams"].appendChunk, {
    streamId,
    chunk,
  });
}

async function emitActivity(
  ctx: ActionCtx,
  payload: {
    projectId: Id<"projects">;
    documentId?: Id<"documents">;
    actorType: "ai" | "user" | "system";
    actorUserId?: string;
    actorAgentId?: string;
    actorName?: string;
    action: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await ctx.runMutation((internal as any)["activity"].emit, payload);
}

function buildEmptyContext(): RAGContext {
  return { documents: [], entities: [], memories: [] };
}

function resolveE2EScenario(contextHints: unknown): string | undefined {
  if (!contextHints || typeof contextHints !== "object") return undefined;
  const hints = contextHints as { e2eScenario?: unknown; testScenario?: unknown };
  if (typeof hints.e2eScenario === "string" && hints.e2eScenario.trim().length > 0) {
    return hints.e2eScenario;
  }
  if (typeof hints.testScenario === "string" && hints.testScenario.trim().length > 0) {
    return hints.testScenario;
  }
  return undefined;
}

export const runSagaAgentChatToStream = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    prompt: v.string(),
    threadId: v.optional(v.string()),
    mode: v.optional(v.string()),
    editorContext: v.optional(v.any()),
    contextHints: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { streamId, projectId, userId, prompt, mode, editorContext, contextHints } = args;
    const isTemplateBuilder = projectId === "template-builder";
    const projectIdValue = projectId as Id<"projects">;
    const testMode = TEST_MODE;

    if (!testMode && !process.env["OPENROUTER_API_KEY"]) {
      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    let presenceDocumentId: string | undefined;
    let lastAiPresenceAt = 0;

    try {
      const startTime = Date.now();

      if (E2E_TEST_MODE) {
        const scenario = resolveE2EScenario(contextHints) ?? "default";
        const script = await ctx.runQuery((internal as any)["e2e"].getSagaScript, {
          projectId: projectIdValue,
          userId,
          scenario,
        });
        if (!script) {
          throw new Error(`Missing E2E saga script for scenario: ${scenario}`);
        }
        setSagaTestScript(script.steps as SagaTestStreamStep[]);
      }

      const sagaAgent = getSagaAgent();
      let threadId = args.threadId;
      const editorDocumentId = resolveEditorDocumentId(editorContext);
      let threadScope: "project" | "document" | "private" = editorDocumentId ? "document" : "project";
      let threadDocumentId: Id<"documents"> | undefined = editorDocumentId
        ? (editorDocumentId as Id<"documents">)
        : undefined;

      if (threadId && !isTemplateBuilder) {
        const threadAccess = await ctx.runQuery((internal as any)["ai/threads"].assertThreadAccess, {
          threadId,
          projectId: projectIdValue,
          userId,
        });
        threadScope = threadAccess.scope;
        threadDocumentId = threadAccess.documentId ?? undefined;
      } else {
        threadId = (await sagaAgent.createThread(ctx, {
          userId,
          title: "Saga Conversation",
        })).threadId;
      }

      const aiActor: ToolActorContext = {
        actorType: "ai",
        actorUserId: userId,
        actorAgentId: "muse",
        actorName: "Muse",
      };
      const activityDocumentId = threadDocumentId ?? undefined;

      if (!isTemplateBuilder) {
        await ctx.runMutation((internal as any)["ai/threads"].upsertThread, {
          threadId,
          projectId: projectIdValue,
          userId,
          scope: threadScope,
          documentId: threadDocumentId,
        });
      }

      presenceDocumentId = editorDocumentId ?? (threadDocumentId ? String(threadDocumentId) : undefined);
      if (!isTemplateBuilder && presenceDocumentId) {
        const now = Date.now();
        try {
          await setAiPresence(ctx, projectId, presenceDocumentId, true);
        } catch (error) {
          console.warn("[agentRuntime] Failed to set AI presence:", error);
        }
        lastAiPresenceAt = now;
      }

      const { messageId: promptMessageId } = await sagaAgent.saveMessage(ctx, {
        threadId,
        userId,
        message: {
          role: "user",
          content: prompt,
        },
        metadata: {
          providerMetadata: {
            saga: { projectId, editorContext, contextHints },
          },
        },
      });

      // Track stream started
      await ServerAgentEvents.streamStarted(userId, projectId, threadId!, DEFAULT_MODEL);

      const shouldSkipRag = testMode || isTemplateBuilder;
      const lexicalDocuments = shouldSkipRag
        ? []
        : await ctx.runQuery((internal as any)["ai/lexical"].searchDocuments, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });
      const lexicalEntities = shouldSkipRag
        ? []
        : await ctx.runQuery((internal as any)["ai/lexical"].searchEntities, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });

      const ragContext = shouldSkipRag
        ? buildEmptyContext()
        : await retrieveRAGContext(prompt, projectId, {
            excludeMemories: false,
            lexical: { documents: lexicalDocuments, entities: lexicalEntities },
            chunkContext: { before: 2, after: 1 },
          });

      if (!shouldSkipRag) {
        // Track RAG context retrieved
        await ServerAgentEvents.ragContextRetrieved(
          userId,
          ragContext.documents.length,
          ragContext.entities.length,
          ragContext.memories.length
        );
      }

      await appendStreamChunk(ctx, streamId, {
        type: "context",
        content: "",
        data: {
          ...ragContext,
          threadId,
        },
      });

      const systemPrompt = buildSystemPrompt({
        mode,
        ragContext,
        editorContext,
      });

      const result = await sagaAgent.streamText(
        ctx,
        { threadId },
        {
          promptMessageId,
          system: systemPrompt,
        } as any
      );

      for await (const delta of result.textStream) {
        if (delta) {
          await appendStreamChunk(ctx, streamId, {
            type: "delta",
            content: delta,
          });
        }
        lastAiPresenceAt = await maybeKeepAiTypingAlive({
          ctx,
          projectId,
          presenceDocumentId,
          isTemplateBuilder,
          lastAiPresenceAt,
        });
      }

      let toolCalls = await result.toolCalls;
      let currentResult = result;
      let currentPromptMessageId = promptMessageId;

      while (toolCalls.length > 0) {
        const ragCalls = toolCalls.filter((c) => autoExecuteTools.has(c.toolName));
        const worldGraphCalls = toolCalls.filter((c) => worldGraphTools.has(c.toolName));
        const otherCalls = toolCalls.filter(
          (c) => !autoExecuteTools.has(c.toolName) && !worldGraphTools.has(c.toolName)
        );

        // Execute RAG tools (always auto)
        for (const call of ragCalls) {
          const toolResult = await executeRagTool(ctx, call.toolName, call.input as Record<string, unknown>, projectId);

          await sagaAgent.saveMessage(ctx, {
            threadId: threadId!,
            userId,
            message: {
              role: "tool",
              content: [{ type: "tool-result", toolCallId: call.toolCallId, toolName: call.toolName, result: toolResult }],
            },
          });

          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            data: toolResult,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_executed",
              summary: `Executed ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId: currentPromptMessageId,
                args: call.input,
              },
            });
          }
        }

        // Process world graph tools - auto-execute or request approval based on impact
        const autoWorldGraphCalls: typeof worldGraphCalls = [];
        const pendingWorldGraphCalls: typeof worldGraphCalls = [];

        for (const call of worldGraphCalls) {
          const args = call.input as Record<string, unknown>;
          if (needsToolApproval(call.toolName, args)) {
            pendingWorldGraphCalls.push(call);
          } else {
            autoWorldGraphCalls.push(call);
          }
        }

        // Auto-execute low-impact world graph tools
        for (const call of autoWorldGraphCalls) {
          const toolResult = await executeWorldGraphTool(
            ctx,
            call.toolName,
            call.input as Record<string, unknown>,
            projectId,
            aiActor,
            {
              streamId,
              threadId,
              toolCallId: call.toolCallId,
              promptMessageId: currentPromptMessageId,
            }
          );

          await sagaAgent.saveMessage(ctx, {
            threadId: threadId!,
            userId,
            message: {
              role: "tool",
              content: [{ type: "tool-result", toolCallId: call.toolCallId, toolName: call.toolName, result: toolResult }],
            },
          });

          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            data: toolResult,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_executed",
              summary: `Executed ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId: currentPromptMessageId,
                args: call.input,
              },
            });
          }
        }

        // Request approval for high-impact world graph tools
        for (const call of pendingWorldGraphCalls) {
          const approvalArgs = call.input as Record<string, unknown>;
          await appendStreamChunk(ctx, streamId, {
            type: "tool-approval-request",
            content: "",
            approvalId: call.toolCallId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            approvalType: resolveApprovalType(call.toolName),
            danger: resolveApprovalDanger(call.toolName, approvalArgs),
            args: call.input,
            promptMessageId: currentPromptMessageId,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_approval_requested",
              summary: `Approval requested for ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId: currentPromptMessageId,
                args: call.input,
              },
            });
          }
        }

        // Handle other tools (ask_question, write_content)
        for (const call of otherCalls) {
          const args = call.input as Record<string, unknown>;
          if (needsToolApproval(call.toolName, args)) {
            await appendStreamChunk(ctx, streamId, {
              type: "tool-approval-request",
              content: "",
              approvalId: call.toolCallId,
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              approvalType: resolveApprovalType(call.toolName),
              danger: resolveApprovalDanger(call.toolName, args),
              args: call.input,
              promptMessageId: currentPromptMessageId,
            });

            if (!isTemplateBuilder) {
              await emitActivity(ctx, {
                projectId: projectIdValue,
                documentId: activityDocumentId,
                ...aiActor,
                action: "ai_tool_approval_requested",
                summary: `Approval requested for ${call.toolName}`,
                metadata: {
                  toolName: call.toolName,
                  toolCallId: call.toolCallId,
                  streamId,
                  threadId,
                  promptMessageId: currentPromptMessageId,
                  args: call.input,
                },
              });
            }
          } else {
            await appendStreamChunk(ctx, streamId, {
              type: "tool",
              content: "",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.input,
              promptMessageId: currentPromptMessageId,
            });

            if (!isTemplateBuilder) {
              await emitActivity(ctx, {
                projectId: projectIdValue,
                documentId: activityDocumentId,
                ...aiActor,
                action: "ai_tool_executed",
                summary: `Executed ${call.toolName}`,
                metadata: {
                  toolName: call.toolName,
                  toolCallId: call.toolCallId,
                  streamId,
                  threadId,
                  promptMessageId: currentPromptMessageId,
                  args: call.input,
                },
              });
            }
          }
        }

        // Stop if there are pending approvals
        const pendingCalls = [...pendingWorldGraphCalls, ...otherCalls];
        const autoExecutedCalls = [...ragCalls, ...autoWorldGraphCalls];
        if (pendingCalls.length > 0 || autoExecutedCalls.length === 0) {
          break;
        }

        currentResult = await sagaAgent.streamText(
          ctx,
          { threadId: threadId! },
          { promptMessageId: currentPromptMessageId, system: systemPrompt } as any
        );

        for await (const delta of currentResult.textStream) {
          if (delta) {
            await appendStreamChunk(ctx, streamId, { type: "delta", content: delta });
          }
          lastAiPresenceAt = await maybeKeepAiTypingAlive({
            ctx,
            projectId,
            presenceDocumentId,
            isTemplateBuilder,
            lastAiPresenceAt,
          });
        }

        toolCalls = await currentResult.toolCalls;
      }

      // Track stream completed
      await ServerAgentEvents.streamCompleted(userId, Date.now() - startTime);

      if (!isTemplateBuilder && presenceDocumentId) {
        try {
          await setAiPresence(ctx, projectId, presenceDocumentId, false);
        } catch (error) {
          console.warn("[agentRuntime] Failed to clear AI presence:", error);
        }
      }

      await ctx.runMutation((internal as any)["ai/streams"].complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.runSagaAgentChatToStream] Error:", error);

      if (!isTemplateBuilder && presenceDocumentId) {
        try {
          await setAiPresence(ctx, projectId, presenceDocumentId, false);
        } catch (presenceError) {
          console.warn("[agentRuntime] Failed to clear AI presence:", presenceError);
        }
      }

      // Track stream failed
      await ServerAgentEvents.streamFailed(userId, error instanceof Error ? error.message : "Unknown error");

      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

export const applyToolResultAndResumeToStream = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    threadId: v.string(),
    promptMessageId: v.string(),
    toolCallId: v.string(),
    toolName: v.string(),
    result: v.any(),
    editorContext: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const {
      streamId,
      projectId,
      userId,
      threadId,
      promptMessageId,
      toolCallId,
      toolName,
      result,
      editorContext,
    } = args;
    const isTemplateBuilder = projectId === "template-builder";
    const projectIdValue = projectId as Id<"projects">;
    const aiActor: ToolActorContext = {
      actorType: "ai",
      actorUserId: userId,
      actorAgentId: "muse",
      actorName: "Muse",
    };
    const testMode = TEST_MODE;

    if (!testMode && !process.env["OPENROUTER_API_KEY"]) {
      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    let presenceDocumentId: string | undefined;
    let activityDocumentId: Id<"documents"> | undefined;
    let lastAiPresenceAt = 0;

    try {
      if (E2E_TEST_MODE) {
        const script = await ctx.runQuery((internal as any)["e2e"].getSagaScript, {
          projectId: projectIdValue,
          userId,
          scenario: "default",
        });
        if (!script) {
          throw new Error("Missing E2E saga script for tool resume");
        }
        setSagaTestScript(script.steps as SagaTestStreamStep[]);
      }

      const sagaAgent = getSagaAgent();
      if (!isTemplateBuilder) {
        const threadAccess = await ctx.runQuery((internal as any)["ai/threads"].assertThreadAccess, {
          threadId,
          projectId: projectIdValue,
          userId,
        });
        presenceDocumentId =
          resolveEditorDocumentId(editorContext) ??
          (threadAccess.documentId ? String(threadAccess.documentId) : undefined);
        activityDocumentId = threadAccess.documentId ??
          (resolveEditorDocumentId(editorContext) as Id<"documents"> | undefined);

        if (presenceDocumentId) {
          const now = Date.now();
          try {
            await setAiPresence(ctx, projectId, presenceDocumentId, true);
          } catch (error) {
            console.warn("[agentRuntime] Failed to set AI presence:", error);
          }
          lastAiPresenceAt = now;
        }
      }

      await sagaAgent.saveMessage(ctx, {
        threadId,
        userId,
        message: {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId,
              toolName,
              result,
            },
          ],
        },
        metadata: {
          providerMetadata: { saga: { projectId } },
        },
      });

      if (!isTemplateBuilder) {
        await emitActivity(ctx, {
          projectId: projectIdValue,
          documentId: activityDocumentId,
          ...aiActor,
          action: "ai_tool_executed",
          summary: `Executed ${toolName}`,
          metadata: {
            toolName,
            toolCallId,
            streamId,
            threadId,
            promptMessageId,
          },
        });
      }

      const systemPrompt = buildSystemPrompt({
        mode: "editing",
        ragContext: buildEmptyContext(),
        editorContext,
      });

      const resumeResult = await sagaAgent.streamText(
        ctx,
        { threadId },
        {
          promptMessageId,
          system: systemPrompt,
        } as any
      );

      for await (const delta of resumeResult.textStream) {
        if (delta) {
          await appendStreamChunk(ctx, streamId, {
            type: "delta",
            content: delta,
          });
        }
        lastAiPresenceAt = await maybeKeepAiTypingAlive({
          ctx,
          projectId,
          presenceDocumentId,
          isTemplateBuilder,
          lastAiPresenceAt,
        });
      }

      const toolCalls = await resumeResult.toolCalls;
      for (const call of toolCalls) {
        const callArgs = call.input as Record<string, unknown>;
        if (needsToolApproval(call.toolName, callArgs)) {
          await appendStreamChunk(ctx, streamId, {
            type: "tool-approval-request",
            content: "",
            approvalId: call.toolCallId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            approvalType: resolveApprovalType(call.toolName),
            danger: resolveApprovalDanger(call.toolName, callArgs),
            args: call.input,
            promptMessageId,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_approval_requested",
              summary: `Approval requested for ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId,
                args: call.input,
              },
            });
          }
        } else {
          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            promptMessageId,
          });

          if (!isTemplateBuilder) {
            await emitActivity(ctx, {
              projectId: projectIdValue,
              documentId: activityDocumentId,
              ...aiActor,
              action: "ai_tool_executed",
              summary: `Executed ${call.toolName}`,
              metadata: {
                toolName: call.toolName,
                toolCallId: call.toolCallId,
                streamId,
                threadId,
                promptMessageId,
                args: call.input,
              },
            });
          }
        }
      }

      if (!isTemplateBuilder && presenceDocumentId) {
        try {
          await setAiPresence(ctx, projectId, presenceDocumentId, false);
        } catch (error) {
          console.warn("[agentRuntime] Failed to clear AI presence:", error);
        }
      }

      await ctx.runMutation((internal as any)["ai/streams"].complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.applyToolResultAndResumeToStream] Error:", error);

      if (!isTemplateBuilder && presenceDocumentId) {
        try {
          await setAiPresence(ctx, projectId, presenceDocumentId, false);
        } catch (presenceError) {
          console.warn("[agentRuntime] Failed to clear AI presence:", presenceError);
        }
      }

      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
