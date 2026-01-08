/**
 * Saga Agent Runtime
 *
 * Bridges the Convex Agent component with the Saga SSE stream model.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { Agent } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { buildSystemPrompt, retrieveRAGContext, type RAGContext } from "./rag";
import { askQuestionTool, writeContentTool } from "./tools/editorTools";
import {
  searchContextTool,
  readDocumentTool,
  searchChaptersTool,
  searchWorldTool,
  getEntityTool,
} from "./tools/ragTools";
import { createQwenEmbeddingModel } from "../lib/deepinfraEmbedding";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";
const LEXICAL_LIMIT = 20;

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  headers: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://mythos.app",
    "X-Title": process.env.OPENROUTER_APP_NAME ?? "Saga AI",
  },
});

export type SagaTestStreamChunk = Record<string, unknown> & { type: string };

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
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
  }
  return normalized;
}

function createTestLanguageModel() {
  return new MockLanguageModelV3({
    doGenerate: async () =>
      ({
        text: "",
        finishReason: { unified: "stop", raw: "stop" },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }) as unknown as Record<string, unknown>,
    doStream: async () => {
      const step = sagaTestScript.shift();
      if (!step) {
        throw new Error("No saga test script step available");
      }
      return {
        stream: simulateReadableStream({ chunks: normalizeTestChunks(step.chunks) }),
      };
    },
  });
}

function createSagaAgent() {
  const testMode = process.env.SAGA_TEST_MODE === "true";
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

const approvalTools = new Set(["ask_question", "write_content"]);
const autoExecuteTools = new Set([
  "search_context",
  "read_document",
  "search_chapters",
  "search_world",
  "get_entity",
]);

type ActionCtx = Parameters<Parameters<typeof internalAction>[0]>[0];

async function executeRagTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  projectId: string
): Promise<unknown> {
  switch (toolName) {
    case "search_context":
      return ctx.runAction(internal.ai.tools.ragHandlers.executeSearchContext, {
        projectId,
        query: args.query as string,
        scope: args.scope as string | undefined,
        limit: args.limit as number | undefined,
      });
    case "read_document":
      return ctx.runAction(internal.ai.tools.ragHandlers.executeReadDocument, {
        projectId,
        documentId: args.documentId as string,
      });
    case "search_chapters":
      return ctx.runAction(internal.ai.tools.ragHandlers.executeSearchChapters, {
        projectId,
        query: args.query as string,
        type: args.type as string | undefined,
      });
    case "search_world":
      return ctx.runAction(internal.ai.tools.ragHandlers.executeSearchWorld, {
        projectId,
        query: args.query as string,
        category: args.category as string | undefined,
      });
    case "get_entity":
      return ctx.runAction(internal.ai.tools.ragHandlers.executeGetEntity, {
        projectId,
        entityId: args.entityId as string,
        includeRelationships: args.includeRelationships as boolean | undefined,
      });
    default:
      throw new Error(`Unknown RAG tool: ${toolName}`);
  }
}

async function appendStreamChunk(
  ctx: Parameters<Parameters<typeof internalAction>[0]>[0],
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
  await ctx.runMutation(internal.ai.streams.appendChunk, {
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

    if (!process.env.OPENROUTER_API_KEY) {
      await ctx.runMutation(internal.ai.streams.fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    try {
      const sagaAgent = getSagaAgent();
      let threadId = args.threadId;
      if (threadId && !isTemplateBuilder) {
        await ctx.runQuery(internal.ai.threads.assertThreadOwnership, {
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
        await ctx.runMutation(internal.ai.threads.upsertThread, {
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
          projectId,
          editorContext,
          contextHints,
        },
      });

      const lexicalDocuments = isTemplateBuilder
        ? []
        : await ctx.runQuery(internal.ai.lexical.searchDocuments, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });
      const lexicalEntities = isTemplateBuilder
        ? []
        : await ctx.runQuery(internal.ai.lexical.searchEntities, {
            projectId: projectIdValue,
            query: prompt,
            limit: LEXICAL_LIMIT,
          });

      const ragContext = await retrieveRAGContext(prompt, projectId, {
        excludeMemories: false,
        lexical: { documents: lexicalDocuments, entities: lexicalEntities },
        chunkContext: { before: 2, after: 1 },
      });

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
        }
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
        const autoExecuteCalls = toolCalls.filter((c) => autoExecuteTools.has(c.toolName));
        const pendingCalls = toolCalls.filter((c) => !autoExecuteTools.has(c.toolName));

        for (const call of autoExecuteCalls) {
          const toolResult = await executeRagTool(ctx, call.toolName, call.args, projectId);

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
            args: call.args,
            data: toolResult,
          });
        }

        for (const call of pendingCalls) {
          if (approvalTools.has(call.toolName)) {
            await appendStreamChunk(ctx, streamId, {
              type: "tool-approval-request",
              content: "",
              approvalId: call.toolCallId,
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.args,
              promptMessageId: currentPromptMessageId,
            });
          } else {
            await appendStreamChunk(ctx, streamId, {
              type: "tool",
              content: "",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.args,
              promptMessageId: currentPromptMessageId,
            });
          }
        }

        if (pendingCalls.length > 0 || autoExecuteCalls.length === 0) {
          break;
        }

        currentResult = await sagaAgent.streamText(
          ctx,
          { threadId: threadId! },
          { promptMessageId: currentPromptMessageId, system: systemPrompt }
        );

        for await (const delta of currentResult.textStream) {
          if (delta) {
            await appendStreamChunk(ctx, streamId, { type: "delta", content: delta });
          }
        }

        toolCalls = await currentResult.toolCalls;
      }

      await ctx.runMutation(internal.ai.streams.complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.runSagaAgentChatToStream] Error:", error);
      await ctx.runMutation(internal.ai.streams.fail, {
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

    if (!process.env.OPENROUTER_API_KEY) {
      await ctx.runMutation(internal.ai.streams.fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    try {
      const sagaAgent = getSagaAgent();
      if (!isTemplateBuilder) {
        await ctx.runQuery(internal.ai.threads.assertThreadOwnership, {
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
          projectId,
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
        }
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
        if (approvalTools.has(call.toolName)) {
          await appendStreamChunk(ctx, streamId, {
            type: "tool-approval-request",
            content: "",
            approvalId: call.toolCallId,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.args,
            promptMessageId,
          });
        } else {
          await appendStreamChunk(ctx, streamId, {
            type: "tool",
            content: "",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            args: call.args,
            promptMessageId,
          });
        }
      }

      await ctx.runMutation(internal.ai.streams.complete, { streamId });
    } catch (error) {
      console.error("[agentRuntime.applyToolResultAndResumeToStream] Error:", error);
      await ctx.runMutation(internal.ai.streams.fail, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
