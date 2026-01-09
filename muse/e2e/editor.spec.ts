import { test, expect } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";
import { waitForConvexDocumentText, waitForCondition } from "./utils/wait-for";

function extractId(text: string | null) {
  if (!text) return null;
  const parts = text.split(":");
  return parts.length > 1 ? parts.slice(1).join(":").trim() : null;
}

test("editor content persists after reload", async ({ page }) => {
  const runId = `${Date.now()}`;
  const content = `E2E_SAVE_${runId}`;

  await page.goto("/e2e");
  await page.getByTestId("e2e-project-name").fill(`E2E/Editor/${runId}`);
  await page.getByTestId("e2e-create-project").click();

  await page.getByTestId("e2e-document-title").fill(`Editor Doc ${runId}`);
  await page.getByTestId("e2e-create-document").click();

  const documentIdText = await page.getByTestId("e2e-document-id").textContent();
  const documentId = extractId(documentIdText);
  expect(documentId).toBeTruthy();

  await page.getByTestId("e2e-open-editor").click();
  await expect(page).toHaveURL(/\/editor/);

  const editor = page.getByTestId("editor-surface");
  await editor.click();
  await page.keyboard.type(content);

  await waitForCondition(async () => {
    const text = await editor.innerText();
    return text.includes(content);
  });

  try {
    const convex = await getConvexHelpers(page);
    await waitForConvexDocumentText(convex, documentId as string, content, 25_000);
  } catch {
    // Optional: Convex polling requires auth token in storage.
  }

  await page.reload();
  const editorAfterReload = page.getByTestId("editor-surface");
  await expect(editorAfterReload).toContainText(content);
});
