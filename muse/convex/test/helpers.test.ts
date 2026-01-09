import { internal } from "../_generated/api";
import type { StreamChunk } from "../ai/streams";
import type { SagaTestStreamStep } from "../ai/agentRuntime";

export function withTestEnv() {
  const previous = {
    SAGA_TEST_MODE: process.env["SAGA_TEST_MODE"],
    OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"],
  };

  process.env["SAGA_TEST_MODE"] = "true";
  if (!process.env["OPENROUTER_API_KEY"]) {
    process.env["OPENROUTER_API_KEY"] = "test";
  }

  return () => {
    process.env["SAGA_TEST_MODE"] = previous.SAGA_TEST_MODE;
    process.env["OPENROUTER_API_KEY"] = previous.OPENROUTER_API_KEY;
  };
}

export function makeIdentity(userId: string) {
  return {
    subject: userId,
    issuer: "https://convex.test",
  };
}

export function buildTextStep(text: string, id = "text-1"): SagaTestStreamStep {
  return {
    chunks: [
      { type: "text-start", id },
      { type: "text-delta", id, delta: text },
      { type: "text-end", id },
    ],
  };
}

export function buildToolCallStep(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>
): SagaTestStreamStep {
  return {
    chunks: [
      {
        type: "tool-call",
        toolCallId,
        toolName,
        input: JSON.stringify(input),
      },
    ],
  };
}

export async function drainStream(
  t: { query: (...args: any[]) => Promise<any> },
  streamId: string,
  options?: { pollMs?: number; maxIterations?: number }
): Promise<{
  status: string;
  chunks: StreamChunk[];
  result?: unknown;
  error?: string;
}> {
  const pollMs = options?.pollMs ?? 5;
  const maxIterations = options?.maxIterations ?? 100;
  const chunks: StreamChunk[] = [];
  let afterIndex = 0;
  let status = "streaming";
  let result: unknown;
  let error: string | undefined;

  for (let i = 0; i < maxIterations; i += 1) {
    const response = await t.query((internal as any)["ai/streams"].getChunks, {
      streamId,
      afterIndex,
    });
    if (!response) {
      throw new Error("Stream not found");
    }

    status = response.status;
    result = response.result;
    error = response.error;

    if (response.chunks.length > 0) {
      chunks.push(...response.chunks);
      afterIndex = chunks[chunks.length - 1]!.index + 1;
    }

    if (status !== "streaming") {
      break;
    }

    if (pollMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  return { status, chunks, result, error };
}
