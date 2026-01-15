/**
 * Thread Summarization Action
 *
 * Summarizes a conversation thread to reduce context size.
 * Used when token usage exceeds thresholds.
 */

"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal, components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { resolveOpenRouterKey, isByokRequest } from "../lib/openRouterKey";
import { assertAiAllowed } from "../lib/quotaEnforcement";
import { Agent } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const SUMMARIZE_MODEL = "anthropic/claude-sonnet-4";
const MAX_MESSAGES_TO_SUMMARIZE = 50;
const SUMMARIZATION_TOKEN_THRESHOLD = 6000;
const AUTO_SUMMARIZE_THRESHOLD = 8000;

// Estimate tokens from text (rough heuristic: ~4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function createOpenRouterClient(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://rhei.team",
      "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Rhei",
    },
  });
}

type AgentMessage = {
  _id: string;
  message: {
    role: "user" | "assistant" | "system" | "tool";
    content: string | Array<{ type: string; text?: string }>;
  };
  _creationTime: number;
};

type SummarizationResult = {
  summary: string;
  originalMessageCount: number;
  summarizedMessageCount: number;
  estimatedTokensSaved: number;
  newThreadId?: string;
};

const SUMMARIZE_SYSTEM_PROMPT = `You are a conversation summarizer for a creative writing assistant.
Your task is to create a concise summary of the conversation that preserves:
1. Key decisions made by the user
2. Important context about the story/project
3. Specific requests or preferences mentioned
4. Any entities, characters, or plot points discussed

The summary should be in a format that allows continuing the conversation naturally.
Keep the summary under 500 words. Use bullet points for key facts.`;

function extractMessageText(message: AgentMessage["message"]): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  return message.content
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text ?? "")
    .join("\n");
}

async function fetchThreadMessages(
  ctx: any,
  threadId: string,
  limit: number
): Promise<AgentMessage[]> {
  // Query the Agent component's messages table directly
  const messages = await ctx.runQuery(
    components.agent.public.listThreadMessages,
    { threadId, limit, order: "asc" }
  );
  return (messages?.page ?? []) as AgentMessage[];
}

export const estimateThreadTokens = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }): Promise<{ tokens: number; messageCount: number }> => {
    const messages = await fetchThreadMessages(ctx, threadId, MAX_MESSAGES_TO_SUMMARIZE);

    if (!messages || messages.length === 0) {
      return { tokens: 0, messageCount: 0 };
    }

    let totalTokens = 0;
    for (const msg of messages) {
      const text = extractMessageText(msg.message);
      totalTokens += estimateTokens(text);
    }

    return { tokens: totalTokens, messageCount: messages.length };
  },
});

export const shouldAutoSummarize = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }): Promise<boolean> => {
    const { tokens } = await ctx.runAction(
      internal.ai.summarizeThread.estimateThreadTokens,
      { threadId }
    );
    return tokens >= AUTO_SUMMARIZE_THRESHOLD;
  },
});

export const summarizeThread = action({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    createNewThread: v.optional(v.boolean()),
    byokKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SummarizationResult> => {
    const { threadId, projectId, createNewThread = false, byokKey } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const userId = identity.subject;

    // Validate API key
    const isByok = isByokRequest(byokKey);
    const apiKey = resolveOpenRouterKey(byokKey);

    // Check quota (skip for BYOK)
    if (!isByok) {
      await assertAiAllowed(ctx, {
        userId,
        endpoint: "summarize",
        promptText: "",
      });
    }

    // Fetch messages from Agent component
    const messages = await fetchThreadMessages(ctx, threadId, MAX_MESSAGES_TO_SUMMARIZE);

    if (!messages || messages.length === 0) {
      return {
        summary: "",
        originalMessageCount: 0,
        summarizedMessageCount: 0,
        estimatedTokensSaved: 0,
      };
    }

    // Calculate original tokens
    let originalTokens = 0;
    const conversationLines: string[] = [];
    for (const msg of messages) {
      const text = extractMessageText(msg.message);
      if (text) {
        originalTokens += estimateTokens(text);
        const roleLabel = msg.message.role === "user" ? "User" : "Assistant";
        conversationLines.push(`${roleLabel}: ${text}`);
      }
    }

    // Check if summarization is needed
    if (originalTokens < SUMMARIZATION_TOKEN_THRESHOLD) {
      return {
        summary: "",
        originalMessageCount: messages.length,
        summarizedMessageCount: 0,
        estimatedTokensSaved: 0,
      };
    }

    // Build conversation text for summarization
    const conversationText = conversationLines.join("\n\n");
    const userPrompt = `Please summarize the following conversation:\n\n${conversationText}`;

    // Call summarization model
    const client = createOpenRouterClient(apiKey);
    const response = await client.chat(SUMMARIZE_MODEL).doGenerate({
      inputFormat: "messages",
      mode: { type: "regular" },
      prompt: [
        { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
        { role: "user", content: [{ type: "text", text: userPrompt }] },
      ],
    });

    const summary = response.content
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join("");

    const summaryTokens = estimateTokens(summary);
    const tokensSaved = Math.max(0, originalTokens - summaryTokens);

    let newThreadId: string | undefined;

    if (createNewThread) {
      // Create a new thread with the summary as the first message
      const agent = new Agent(components.agent, {
        name: "Saga",
        languageModel: client.chat(SUMMARIZE_MODEL),
      });

      const newThread = await agent.createThread(ctx, {
        userId,
        title: "Continued Conversation",
      });
      newThreadId = newThread.threadId;

      // Add summary as a system message
      await agent.saveMessage(ctx, {
        threadId: newThreadId,
        userId,
        message: {
          role: "system",
          content: `[Previous conversation summary]\n\n${summary}`,
        },
      });

      // Update thread mapping
      await ctx.runMutation((internal as any)["ai/threads"].upsertThread, {
        threadId: newThreadId,
        projectId,
        userId,
        scope: "project",
      });
    }

    return {
      summary,
      originalMessageCount: messages.length,
      summarizedMessageCount: 1,
      estimatedTokensSaved: tokensSaved,
      newThreadId,
    };
  },
});

export const getThreadUsageEstimate = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }): Promise<{
    estimatedTokens: number;
    messageCount: number;
    shouldSummarize: boolean;
    warningLevel: "ok" | "warn" | "danger";
  }> => {
    const result = await ctx.runAction(
      internal.ai.summarizeThread.estimateThreadTokens,
      { threadId }
    );

    let warningLevel: "ok" | "warn" | "danger" = "ok";
    if (result.tokens >= AUTO_SUMMARIZE_THRESHOLD) {
      warningLevel = "danger";
    } else if (result.tokens >= SUMMARIZATION_TOKEN_THRESHOLD) {
      warningLevel = "warn";
    }

    return {
      estimatedTokens: result.tokens,
      messageCount: result.messageCount,
      shouldSummarize: result.tokens >= SUMMARIZATION_TOKEN_THRESHOLD,
      warningLevel,
    };
  },
});
