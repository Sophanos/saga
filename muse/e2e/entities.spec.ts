import { test, expect, type Page } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";
import { getRunId } from "./utils/run-id";

const hasE2EHarness =
  process.env.E2E_TEST_MODE === "true" &&
  !!(process.env.PLAYWRIGHT_E2E_SECRET || process.env.E2E_TEST_SECRET);

function skipIfNotWeb(projectName: string): boolean {
  return projectName !== "tauri-web";
}

async function openProject(page: Page, projectId: string): Promise<void> {
  await page.addInitScript((id: string) => {
    window.localStorage.setItem("mythos:lastProjectId", id);
  }, projectId);
  await page.goto("/");
}

test.describe("E2E-04 Entity Detection + World Graph", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(skipIfNotWeb(testInfo.project.name), "World Graph is web-only");
  });
  test.skip(!hasE2EHarness, "E2E harness not configured");

  test("detects entities and renders world graph", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "entities");
    const convex = await getConvexHelpers(page);

    const projectId = await convex.createProject({
      name: `E2E/WorldGraph/${runId}`,
    });

    await convex.createDocument({
      projectId,
      type: "chapter",
      title: `World Graph Doc ${runId}`,
      contentText: "Seed text",
    });

    await convex.setDetectionFixture({
      projectId,
      entities: [
        { name: "Elena", type: "character" },
        { name: "Citadel", type: "location" },
        { name: "Ashen Guard", type: "faction" },
      ],
    });

    const firstDetection = await convex.detectAndPersist({
      projectId,
      text: "Elena met the Ashen Guard at the Citadel.",
    });

    expect(firstDetection.entities.length).toBeGreaterThanOrEqual(3);

    const entitiesAfterFirst = await convex.listEntities(projectId);
    const initialCount = entitiesAfterFirst.length;
    expect(initialCount).toBeGreaterThanOrEqual(3);

    await convex.setDetectionFixture({
      projectId,
      entities: [
        { name: "Elena", type: "character", aliases: ["Lena"] },
        { name: "Citadel", type: "location" },
        { name: "Ashen Guard", type: "faction" },
      ],
    });

    await convex.detectAndPersist({
      projectId,
      text: "Lena met the Ashen Guard at the Citadel.",
    });

    const entitiesAfterSecond = await convex.listEntities(projectId);
    expect(entitiesAfterSecond.length).toBe(initialCount);

    const elena = entitiesAfterSecond.find((entity) => entity.name === "Elena");
    const citadel = entitiesAfterSecond.find((entity) => entity.name === "Citadel");
    const faction = entitiesAfterSecond.find((entity) => entity.name === "Ashen Guard");

    expect(elena).toBeTruthy();
    expect(citadel).toBeTruthy();
    expect(faction).toBeTruthy();
    expect(elena?.aliases ?? []).toContain("Lena");

    const relationshipId = await convex.createRelationship({
      projectId,
      sourceId: elena?._id as any,
      targetId: citadel?._id as any,
      type: "knows",
      bidirectional: true,
    });

    await openProject(page, projectId as string);
    await expect(page.getByTestId("editor-surface")).toBeVisible();

    await page.keyboard.press("Meta+G");
    await page.keyboard.press("Control+G");

    await expect(page.getByTestId("world-graph-view")).toBeVisible();

    await expect(page.getByTestId(`wg-node-${elena?._id}`)).toBeVisible();
    await expect(page.getByTestId(`wg-node-${citadel?._id}`)).toBeVisible();
    await expect(page.getByTestId(`wg-node-${faction?._id}`)).toBeVisible();

    await expect(page.getByTestId(`wg-edge-${relationshipId}`)).toBeVisible();

    await expect(page.getByTestId("wg-entity-count")).toHaveText("3");
    await expect(page.getByTestId("wg-relationship-count")).toHaveText("1");

    await page.getByTestId("world-graph-toggle-location").click();
    await expect(page.getByTestId("wg-entity-count")).toHaveText("2");
    await expect(page.getByTestId("wg-relationship-count")).toHaveText("0");
    await expect(page.getByTestId(`wg-node-${citadel?._id}`)).toHaveCount(0);
  });
});
