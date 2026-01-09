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
  createEntityNeedsApproval,
  updateEntityNeedsApproval,
  createRelationshipNeedsApproval,
  updateRelationshipNeedsApproval,
} from "./tools/worldGraphTools";
import { createQwenEmbeddingModel } from "../lib/deepinfraEmbedding";
import { ServerAgentEvents } from "../lib/analytics";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const LEXICAL_LIMIT = 20;

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
  const testMode = process.env["SAGA_TEST_MODE"] === "true";
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

const staticApprovalTools = new Set(["ask_question", "write_content"]);
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

function needsToolApproval(toolName: string, args: Record<string, unknown>): boolean {
  if (staticApprovalTools.has(toolName)) return true;

  switch (toolName) {
    case "create_entity":
      return createEntityNeedsApproval(args as Parameters<typeof createEntityNeedsApproval>[0]);
    case "update_entity":
      return updateEntityNeedsApproval(args as Parameters<typeof updateEntityNeedsApproval>[0]);
    case "create_relationship":
      return createRelationshipNeedsApproval(args as Parameters<typeof createRelationshipNeedsApproval>[0]);
    case "update_relationship":
      return updateRelationshipNeedsApproval(args as Parameters<typeof updateRelationshipNeedsApproval>[0]);
    default:
      return false;
  }
}

async function executeRagTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string
): Promise<unknown> {
  switch (toolName) {
    case "search_context":
      // @ts-expect-error Type instantiation deep
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
  projectId: string
): Promise<unknown> {
  switch (toolName) {
    case "create_entity":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeCreateEntity, {
        projectId,
        toolArgs: args,
      });
    case "update_entity":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeUpdateEntity, {
        projectId,
        toolArgs: args,
      });
    case "create_relationship":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeCreateRelationship, {
        projectId,
        toolArgs: args,
      });
    case "update_relationship":
      return ctx.runAction((internal as any)["ai/tools/worldGraphHandlers"].executeUpdateRelationship, {
        projectId,
        toolArgs: args,
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

function buildEmptyContext(): RAGContext {
  return { documents: [], entities: [], memories: [] };
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

    if (!process.env["OPENROUTER_API_KEY"]) {
      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    try {
      const startTime = Date.now();
      const sagaAgent = getSagaAgent();
      let threadId = args.threadId;
      if (threadId && !isTemplateBuilder) {
        await ctx.runQuery((internal as any)["ai/threads"].assertThreadOwnership, {
          threadId,
          projectId: projectIdValue,
          userId,
        });
      } else {
        threadId = (await sagaAgent.createThread(ctx, {
          userId,
          title: "Saga Conversation",
        })).threadId;
      }

      if (!isTemplateBuilder) {
        await ctx.runMutation((internal as any)["ai/threads"].upsertThread, {
          threadId,
          projectId: projectIdValue,
          userId,
        });
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

      const lexicalDocuments = isTemplateBuilder
        ? []
        : await ctx.runQuery((internal as any)["ai/lexical"].searchDocuments, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });
      const lexicalEntities = isTemplateBuilder
        ? []
        : await ctx.runQuery((internal as any)["ai/lexical"].searchEntities, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });

      const ragContext = await retrieveRAGContext(prompt, projectId, {
        excludeMemories: false,
        lexical: { documents: lexicalDocuments, entities: lexicalEntities },
        chunkContext: { before: 2, after: 1 },
      });

      // Track RAG context retrieved
      await ServerAgentEvents.ragContextRetrieved(
        userId,
        ragContext.documents.length,
        ragContext.entities.length,
        ragContext.memories.length
      );

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
          const toolResult = await executeWorldGraphTool(ctx, call.toolName, call.input as Record<string, unknown>, projectId);

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
        }

        // Request approval for high-impact world graph tools
        for (const call of pendingWorldGraphCalls) {
          await appendStreamChunk(ctx, streamId, {
            type: "tool-approval-request",
            content: "",
            approvalId: call.toolCallId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            promptMessageId: currentPromptMessageId,
          });
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
              args: call.input,
              promptMessageId: currentPromptMessageId,
            });
          } else {
            await appendStreamChunk(ctx, streamId, {
              type: "tool",
              content: "",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.input,
              promptMessageId: currentPromptMessageId,
            });
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
        }

        toolCalls = await currentResult.toolCalls;
      }

      // Track stream completed
      await ServerAgentEvents.streamCompleted(userId, Date.now() - startTime);

      await ctx.runMutation((internal as any)["ai/streams"].complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.runSagaAgentChatToStream] Error:", error);

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

    if (!process.env["OPENROUTER_API_KEY"]) {
      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    try {
      const sagaAgent = getSagaAgent();
      if (!isTemplateBuilder) {
        await ctx.runQuery((internal as any)["ai/threads"].assertThreadOwnership, {
          threadId,
          projectId: projectIdValue,
          userId,
        });
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
            args: call.input,
            promptMessageId,
          });
        } else {
          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.input,
            promptMessageId,
          });
        }
      }

      await ctx.runMutation((internal as any)["ai/streams"].complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.applyToolResultAndResumeToStream] Error:", error);
      await ctx.runMutation((internal as any)["ai/streams"].fail, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
