import { test, expect, type Locator, type Page } from "@playwright/test";
import { getE2EConvexHelpers } from "./fixtures/convex";
import { getRunId } from "./utils/run-id";
import {
  waitForConvexDocumentText,
  waitForConvexDocumentUpdatedAt,
} from "./utils/wait-for";

async function resolveEditorTestId(page: Page, testId: string): Promise<Locator> {
  const iframe = page.locator('iframe[title="Mythos Editor"]');
  if (await iframe.count()) {
    const frame = page.frameLocator('iframe[title="Mythos Editor"]');
    return frame.getByTestId(testId);
  }
  return page.getByTestId(testId);
}

async function resolveEditableSurface(page: Page): Promise<Locator> {
  const surface = await resolveEditorTestId(page, "editor-surface");
  const editable = surface.locator("[contenteditable='true']");
  if (await editable.count()) {
    return editable.first();
  }
  return surface;
}

test("editor content persists after reload", async ({ page, browser }, testInfo) => {
  const runId = getRunId(testInfo, "editor");
  const content = `E2E_SAVE_${runId}`;

  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") {
      await dialog.accept();
      return;
    }
    await dialog.dismiss();
  });

  await page.goto("/e2e");
  await page.getByTestId("e2e-project-name").fill(`E2E/Editor/${runId}`);
  await page.getByTestId("e2e-create-project").click();

  await page.getByTestId("e2e-document-title").fill(`Editor Doc ${runId}`);
  await page.getByTestId("e2e-create-document").click();

  const projectId = (await page
    .getByTestId("e2e-project-id-value")
    .textContent())?.trim();
  expect(projectId).toBeTruthy();

  const documentId = (await page
    .getByTestId("e2e-document-id-value")
    .textContent())?.trim();
  expect(documentId).toBeTruthy();
  if (!documentId || !projectId) {
    throw new Error("Missing E2E identifiers");
  }

  await page.getByTestId("e2e-open-editor").click();
  await expect(page).toHaveURL(/\/editor/);

  const editorRoot = await resolveEditorTestId(page, "editor-view");
  await expect(editorRoot).toHaveAttribute("data-document-id", documentId);
  await expect(editorRoot).toHaveAttribute("data-project-id", projectId);

  const editorDocumentId = await resolveEditorTestId(page, "editor-document-id");
  await expect(editorDocumentId).toHaveText(documentId);

  const editorReady = await resolveEditorTestId(page, "editor-ready");
  await expect(editorReady).toHaveCount(1);

  const autosaveError = await resolveEditorTestId(page, "autosave-error");
  await expect(autosaveError).toHaveCount(0);

  const e2eConvex = getE2EConvexHelpers();
  const initialDoc = await e2eConvex.getDocumentForE2E(documentId);
  const initialUpdatedAt = initialDoc?.updatedAt ?? 0;

  const editor = await resolveEditableSurface(page);
  await editor.fill(content);
  await expect(editor).toContainText(content);

  await waitForConvexDocumentText(
    { getDocument: e2eConvex.getDocumentForE2E },
    documentId,
    content,
    25_000
  );
  await waitForConvexDocumentUpdatedAt(
    { getDocument: e2eConvex.getDocumentForE2E },
    documentId,
    initialUpdatedAt,
    25_000
  );

  const storageState = await page.context().storageState();
  const baseUrl = new URL(page.url()).origin;
  const freshContext = await browser.newContext({ storageState });
  await freshContext.addInitScript(() => {
    const keepPrefixes = ["better-auth"];
    const keepKeys = ["mythos-auth", "better-auth_cookie"];
    const preserved: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const shouldKeep =
        keepKeys.includes(key) || keepPrefixes.some((prefix) => key.startsWith(prefix));
      if (shouldKeep) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          preserved[key] = value;
        }
      }
    }
    localStorage.clear();
    Object.entries(preserved).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  });

  const freshPage = await freshContext.newPage();
  await freshPage.goto(
    `${baseUrl}/editor?projectId=${projectId}&documentId=${documentId}`
  );

  const freshEditorRoot = await resolveEditorTestId(freshPage, "editor-view");
  await expect(freshEditorRoot).toHaveAttribute("data-document-id", documentId);
  const freshEditorDocumentId = await resolveEditorTestId(
    freshPage,
    "editor-document-id"
  );
  await expect(freshEditorDocumentId).toHaveText(documentId);
  await expect(freshEditorRoot).toHaveAttribute("data-project-id", projectId);
  const freshEditorReady = await resolveEditorTestId(freshPage, "editor-ready");
  await expect(freshEditorReady).toHaveCount(1);
  const freshEditor = await resolveEditableSurface(freshPage);
  await expect(freshEditor).toContainText(content);
  await freshContext.close();
});
