import { test, expect } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";

function extractId(text: string | null) {
  if (!text) return null;
  const parts = text.split(":");
  return parts.length > 1 ? parts.slice(1).join(":").trim() : null;
}

test("detects and persists entities", async ({ page }) => {
  const runId = `${Date.now()}`;

  await page.goto("/e2e");
  await page.getByTestId("e2e-project-name").fill(`E2E/Entities/${runId}`);
  await page.getByTestId("e2e-create-project").click();

  const projectIdText = await page.getByTestId("e2e-project-id").textContent();
  const projectId = extractId(projectIdText);
  expect(projectId).toBeTruthy();

  let convex;
  try {
    convex = await getConvexHelpers(page);
  } catch (error) {
    test.skip(true, "Missing Convex auth token in storage state");
    return;
  }

  const text = "Elena walked to the Citadel.";
  const result = await convex.detectAndPersist({
    projectId: projectId as string,
    text,
  });

  expect(result.entities.length).toBeGreaterThan(0);

  const entities = await convex.listEntities(projectId as string);
  const names = entities.map((entity: { name: string }) => entity.name);

  expect(names).toContain("Elena");
  expect(names).toContain("Citadel");
});
