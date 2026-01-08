import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { retrieveRAGContext } from "../rag";

const originalFetch = globalThis.fetch;

describe("RAG chunk context", () => {
  beforeEach(() => {
    process.env.QDRANT_URL = "https://qdrant.test";
    process.env.DEEPINFRA_API_KEY = "test";

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/points/search")) {
        return new Response(
          JSON.stringify({
            result: [
              {
                id: "point-1",
                score: 0.92,
                payload: {
                  type: "document",
                  document_id: "doc-1",
                  chunk_index: 3,
                  text: "chunk3",
                  title: "Doc",
                  document_type: "chapter",
                },
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.includes("/points/scroll")) {
        return new Response(
          JSON.stringify({
            result: {
              points: [
                { id: "1", payload: { chunk_index: 1, text: "chunk1" } },
                { id: "2", payload: { chunk_index: 2, text: "chunk2" } },
                { id: "3", payload: { chunk_index: 3, text: "chunk3" } },
                { id: "4", payload: { chunk_index: 4, text: "chunk4" } },
              ],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("api.deepinfra.com/v1/inference")) {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (Array.isArray(body.inputs)) {
          return new Response(
            JSON.stringify({ embeddings: [[0.1, 0.2, 0.3]] }),
            { status: 200 }
          );
        }
        if (Array.isArray(body.queries)) {
          return new Response(JSON.stringify({ scores: [0.9] }), { status: 200 });
        }
      }

      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.QDRANT_URL;
    delete process.env.DEEPINFRA_API_KEY;
  });

  test("expands preview with matched chunk first", async () => {
    const context = await retrieveRAGContext("Elena", "project-1", {
      chunkContext: { before: 2, after: 1 },
    });

    const preview = context.documents[0]?.preview ?? "";
    expect(preview.startsWith("chunk3")).toBe(true);
    expect(preview).toContain("Context before");
    expect(preview).toContain("chunk1");
    expect(preview).toContain("Context after");
    expect(preview).toContain("chunk4");
  });
});
