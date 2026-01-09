import { test, expect, type Page } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";

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
  test.skip(({ project }) => skipIfNotWeb(project.name), "World Graph is web-only");
  test.skip(!hasE2EHarness, "E2E harness not configured");

  test("detects entities and renders world graph", async ({ page }) => {
    const runId = `${Date.now()}`;
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

    const detection = await convex.detectAndPersist({
      projectId,
      text: "Elena met the Ashen Guard at the Citadel.",
    });

    expect(detection.entities.length).toBeGreaterThanOrEqual(3);

    if (detection.entities.length >= 2) {
      await convex.createRelationship({
        projectId,
        sourceId: detection.entities[0].id as any,
        targetId: detection.entities[1].id as any,
        type: "knows",
        bidirectional: true,
      });
    }

    await openProject(page, projectId as string);
    await expect(page.getByTestId("editor-surface")).toBeVisible();

    await page.keyboard.press("Meta+G");
    await page.keyboard.press("Control+G");

    await expect(page.getByTestId("world-graph-view")).toBeVisible();

    for (const entity of detection.entities) {
      await expect(page.getByTestId(`wg-node-${entity.id}`)).toBeVisible();
    }

    await expect(page.getByTestId("wg-entity-count")).toHaveText(
      String(detection.entities.length)
    );
  });
});
