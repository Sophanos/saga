import { afterEach, beforeEach, describe, expect, test } from "vitest";
import schema from "../../schema";
import { initConvexTest } from "../../test/setup.test";
import {
  buildTextStep,
  buildToolCallStep,
  drainStream,
  withTestEnv,
} from "../../test/helpers.test";
import { setSagaTestScript } from "../agentRuntime";
import { api, internal } from "../../_generated/api";

const projectId = "template-builder";
const userId = "user-1";

describe("Saga agent runtime", () => {
  let restoreEnv: (() => void) | null = null;

  beforeEach(() => {
    restoreEnv = withTestEnv();
    setSagaTestScript([]);
  });

  afterEach(() => {
    restoreEnv?.();
    restoreEnv = null;
    setSagaTestScript([]);
  });

  test("Agent streams deltas and completes (no tools)", async () => {
    const t = initConvexTest(schema);
    const streamId = await t.mutation((internal as any)["ai/streams"].create, {
      projectId,
      userId,
      type: "saga",
    });

    setSagaTestScript([buildTextStep("Hello from Saga")]);

    await t.action((internal as any)["ai/agentRuntime"].runSagaAgentChatToStream, {
      streamId,
      projectId,
      userId,
      prompt: "Hello",
    });

    const { status, chunks } = await drainStream(t, streamId);
    expect(status).toBe("done");
    expect(chunks.some((chunk) => chunk.type === "delta")).toBe(true);
  });

  test("Agent auto-executes search tool and continues", async () => {
    const t = initConvexTest(schema);
    const streamId = await t.mutation((internal as any)["ai/streams"].create, {
      projectId,
      userId,
      type: "saga",
    });

    setSagaTestScript([
      buildToolCallStep("call-1", "search_context", {
        query: "Factions",
        scope: "documents",
        limit: 3,
      }),
      buildTextStep("Done.", "text-2"),
    ]);

    await t.action((internal as any)["ai/agentRuntime"].runSagaAgentChatToStream, {
      streamId,
      projectId,
      userId,
      prompt: "Find factions",
    });

    const { chunks } = await drainStream(t, streamId);
    const toolIndex = chunks.findIndex(
      (chunk) => chunk.type === "tool" && chunk.toolName === "search_context"
    );
    expect(toolIndex).toBeGreaterThan(-1);
    expect(chunks.slice(toolIndex + 1).some((chunk) => chunk.type === "delta")).toBe(true);
  });

  test("Agent emits approval request and halts", async () => {
    const t = initConvexTest(schema);
    const streamId = await t.mutation((internal as any)["ai/streams"].create, {
      projectId,
      userId,
      type: "saga",
    });

    setSagaTestScript([
      buildToolCallStep("call-approval", "ask_question", {
        question: "What should happen next?",
        detail: "Need clarity",
      }),
    ]);

    await t.action((internal as any)["ai/agentRuntime"].runSagaAgentChatToStream, {
      streamId,
      projectId,
      userId,
      prompt: "Continue",
    });

    const { chunks } = await drainStream(t, streamId);
    const approvalChunk = chunks.find(
      (chunk) => chunk.type === "tool-approval-request"
    );
    expect(approvalChunk?.approvalId).toBe("call-approval");

    const approvalIndex = chunks.findIndex(
      (chunk) => chunk.type === "tool-approval-request"
    );
    const hasDeltaAfter = chunks.slice(approvalIndex + 1).some(
      (chunk) => chunk.type === "delta"
    );
    expect(hasDeltaAfter).toBe(false);
  });

  test("Tool-result continuation resumes generation", async () => {
    const t = initConvexTest(schema);
    const streamId = await t.mutation((internal as any)["ai/streams"].create, {
      projectId,
      userId,
      type: "saga",
    });

    setSagaTestScript([
      buildToolCallStep("call-2", "ask_question", {
        question: "Which POV?",
      }),
    ]);

    await t.action((internal as any)["ai/agentRuntime"].runSagaAgentChatToStream, {
      streamId,
      projectId,
      userId,
      prompt: "Continue",
    });

    const { chunks } = await drainStream(t, streamId);
    const contextChunk = chunks.find((chunk) => chunk.type === "context");
    const threadId = (contextChunk?.data as { threadId?: string } | undefined)?.threadId;
    const approvalChunk = chunks.find(
      (chunk) => chunk.type === "tool-approval-request"
    );

    expect(threadId).toBeTruthy();
    expect(approvalChunk?.toolCallId).toBe("call-2");

    setSagaTestScript([buildTextStep("Continuing after approval", "text-3")]);

    const resumeStreamId = await t.mutation((internal as any)["ai/streams"].create, {
      projectId,
      userId,
      type: "saga-tool-result",
    });

    await t.action((internal as any)["ai/agentRuntime"].applyToolResultAndResumeToStream, {
      streamId: resumeStreamId,
      projectId,
      userId,
      threadId: threadId!,
      promptMessageId: approvalChunk!.promptMessageId!,
      toolCallId: approvalChunk!.toolCallId!,
      toolName: approvalChunk!.toolName!,
      result: { answer: "Third person" },
    });

    const resumed = await drainStream(t, resumeStreamId);
    expect(resumed.status).toBe("done");
    expect(resumed.chunks.some((chunk) => chunk.type === "delta")).toBe(true);
  });

  test("Stream replay returns missed chunks", async () => {
    const t = initConvexTest(schema);
    const streamId = await t.mutation((internal as any)["ai/streams"].create, {
      projectId,
      userId,
      type: "saga",
    });

    setSagaTestScript([buildTextStep("Replay test", "text-4")]);

    await t.action((internal as any)["ai/agentRuntime"].runSagaAgentChatToStream, {
      streamId,
      projectId,
      userId,
      prompt: "Replay",
    });

    const { chunks } = await drainStream(t, streamId);
    // @ts-expect-error Type instantiation deep - generated API types are complex
    const replay = await t.query(api.ai.streams.replay, {
      streamId,
      afterIndex: chunks[1]?.index ?? 0,
    });

    expect(replay?.status).toBe("done");
    expect(replay?.chunks.length).toBeGreaterThan(0);
  });
});
