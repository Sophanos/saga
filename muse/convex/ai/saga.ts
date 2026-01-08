/**
 * Saga AI Agent Actions
 *
 * Compatibility wrappers around the Agent runtime.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const streamChat = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
    mentions: v.optional(v.array(v.object({
      type: v.string(),
      id: v.string(),
      name: v.string(),
    }))),
    mode: v.optional(v.string()),
    editorContext: v.optional(v.any()),
    contextHints: v.optional(v.any()),
    conversationId: v.optional(v.string()),
    persistDeltas: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const lastUserMessage = [...args.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUserMessage?.content ?? "";

    await ctx.runAction(internal.ai.agentRuntime.runSagaAgentChatToStream, {
      streamId: args.streamId,
      projectId: args.projectId,
      userId: args.userId,
      prompt,
      threadId: args.conversationId,
      mode: args.mode,
      editorContext: args.editorContext,
      contextHints: args.contextHints,
    });
  },
});

export const continueWithApproval = internalAction({
  args: {
    streamId: v.string(),
    approvalId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.ai.streams.fail, {
      streamId: args.streamId,
      error: "tool-approval is deprecated; use tool-result continuation",
    });
  },
});
