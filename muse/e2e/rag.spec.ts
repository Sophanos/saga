import { test, expect } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";
import { getRunId } from "./utils/run-id";

const hasQdrant = !!process.env.QDRANT_URL;
const hasE2ESecret = !!(process.env.PLAYWRIGHT_E2E_SECRET || process.env.E2E_TEST_SECRET);
const hasE2EHarness = process.env.E2E_TEST_MODE === "true" && hasE2ESecret;

test.describe("E2E-06 RAG Pipeline", () => {
  test.skip(!hasQdrant, "Qdrant not configured");
  test.skip(!hasE2EHarness, "E2E harness not configured");

  test("retrieves embeddings-backed context", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "rag");
    const uniquePhrase = `E2E_RAG_${runId}_PhoenixSong`;
    const convex = await getConvexHelpers(page);

    const projectId = await convex.createProject({
      name: `E2E/RAG/${runId}`,
    });

    await convex.createDocument({
      projectId,
      type: "chapter",
      title: `RAG Doc ${runId}`,
      contentText: `The ${uniquePhrase} echoes through the citadel halls.`,
    });

    await convex.processEmbeddingJobsNow({ batchSize: 5 });

    const context = await convex.retrieveRagContext({
      projectId,
      query: uniquePhrase,
    });

    const hasMatch = context.documents.some((doc: any) =>
      String(doc.preview ?? "").includes(uniquePhrase)
    );

    expect(hasMatch).toBe(true);
  });
});
