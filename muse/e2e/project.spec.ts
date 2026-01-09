import { test, expect } from "@playwright/test";

function extractId(text: string | null) {
  if (!text) return null;
  const parts = text.split(":");
  return parts.length > 1 ? parts.slice(1).join(":").trim() : null;
}

test("creates project and document via E2E harness", async ({ page }) => {
  const runId = `${Date.now()}`;

  await page.goto("/e2e");
  await page.getByTestId("e2e-project-name").fill(`E2E/Project/${runId}`);
  await page.getByTestId("e2e-create-project").click();

  const projectIdText = await page.getByTestId("e2e-project-id").textContent();
  const projectId = extractId(projectIdText);
  expect(projectId).toBeTruthy();

  await page.getByTestId("e2e-document-title").fill(`E2E Doc ${runId}`);
  await page.getByTestId("e2e-document-type").fill("chapter");
  await page.getByTestId("e2e-create-document").click();

  const documentIdText = await page.getByTestId("e2e-document-id").textContent();
  const documentId = extractId(documentIdText);
  expect(documentId).toBeTruthy();

  await page.getByTestId("e2e-open-editor").click();
  await expect(page).toHaveURL(/\/editor/);
});
