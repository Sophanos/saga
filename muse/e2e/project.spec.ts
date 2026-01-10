import { test, expect, type Locator, type Page } from "@playwright/test";
import { getRunId } from "./utils/run-id";

async function resolveEditorTestId(page: Page, testId: string): Promise<Locator> {
  const iframe = page.locator('iframe[title="Mythos Editor"]');
  if (await iframe.count()) {
    const frame = page.frameLocator('iframe[title="Mythos Editor"]');
    return frame.getByTestId(testId);
  }
  return page.getByTestId(testId);
}

test("creates project and document via E2E harness", async ({ page }, testInfo) => {
  const runId = getRunId(testInfo, "project");

  await page.goto("/e2e");
  await page.getByTestId("e2e-project-name").fill(`E2E/Project/${runId}`);
  await page.getByTestId("e2e-create-project").click();

  const projectId = await page
    .getByTestId("e2e-project-id")
    .getAttribute("data-project-id");
  expect(projectId).toBeTruthy();

  await page.getByTestId("e2e-document-title").fill(`E2E Doc ${runId}`);
  await page.getByTestId("e2e-document-type").fill("chapter");
  await page.getByTestId("e2e-create-document").click();

  const documentId = await page
    .getByTestId("e2e-document-id")
    .getAttribute("data-document-id");
  expect(documentId).toBeTruthy();

  await page.getByTestId("e2e-open-editor").click();
  await expect(page).toHaveURL(/\/editor/);

  if (!documentId || !projectId) {
    throw new Error("Missing E2E identifiers");
  }

  const editorRoot = await resolveEditorTestId(page, "editor-root");
  await expect(editorRoot).toHaveAttribute("data-document-id", documentId);
  await expect(editorRoot).toHaveAttribute("data-project-id", projectId);
  const editorReady = await resolveEditorTestId(page, "editor-ready");
  await expect(editorReady).toHaveCount(1);
});
