/**
 * Saga Agent Runtime
 *
 * Bridges the Convex Agent component with the Saga SSE stream model.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { Agent } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt, retrieveRAGContext, type RAGContext } from "./rag";
import { askQuestionTool, writeContentTool } from "./tools/editorTools";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  headers: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://mythos.app",
    "X-Title": process.env.OPENROUTER_APP_NAME ?? "Saga AI",
  },
});

const sagaAgent = new Agent(components.agent, {
  name: "Saga",
  languageModel: openrouter.chat(DEFAULT_MODEL),
  tools: {
    ask_question: askQuestionTool,
    write_content: writeContentTool,
  },
  maxSteps: 4,
});

const approvalTools = new Set(["ask_question", "write_content"]);

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

    if (!process.env.OPENROUTER_API_KEY) {
      await ctx.runMutation(internal.ai.streams.fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    try {
      const threadId = args.threadId
        ? args.threadId
        : (await sagaAgent.createThread(ctx, {
            userId,
            title: "Saga Conversation",
          })).threadId;

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

      const ragContext = await retrieveRAGContext(prompt, projectId, {
        excludeMemories: false,
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

      const toolCalls = await result.toolCalls;
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

    if (!process.env.OPENROUTER_API_KEY) {
      await ctx.runMutation(internal.ai.streams.fail, {
        streamId,
        error: "OPENROUTER_API_KEY not configured",
      });
      return;
    }

    try {
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
