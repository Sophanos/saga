import { test, expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { buildTestUser, signInE2E } from "./fixtures/auth";
import { getConvexHelpers } from "./fixtures/convex";
import { getRunId } from "./utils/run-id";

function skipIfNotWeb(projectName: string): boolean {
  return projectName !== "tauri-web";
}

async function openProjectAndDocument(
  page: Page,
  args: { projectId: string; documentId: string }
): Promise<void> {
  await page.addInitScript((payload: { projectId: string; documentId: string }) => {
    window.localStorage.setItem("mythos:lastProjectId", payload.projectId);
    window.localStorage.setItem("mythos:lastDocumentId", payload.documentId);
  }, args);
  await page.goto("/");
}

async function resolveEditor(page: Page): Promise<{ editor: Locator; frame: FrameLocator | null }> {
  const iframe = page.locator('iframe[title="Mythos Editor"]');
  if (await iframe.count()) {
    const frame = page.frameLocator('iframe[title="Mythos Editor"]');
    return {
      editor: frame.locator(".ProseMirror").first(),
      frame,
    };
  }

  return {
    editor: page.getByTestId("editor-surface").locator(".ProseMirror"),
    frame: null,
  };
}

async function waitForEditorReady(
  page: Page,
  resolved: { editor: Locator; frame: FrameLocator | null }
): Promise<void> {
  if (resolved.frame) {
    await expect(resolved.frame.getByTestId("collab-editor")).toBeVisible();
  } else {
    const collabRoot = page.getByTestId("collab-editor");
    if (await collabRoot.count()) {
      await expect(collabRoot).toBeVisible();
    } else {
      await expect(page.getByTestId("editor-ready")).toBeAttached();
    }
  }

  await expect(resolved.editor).toBeVisible();
  await expect(resolved.editor).toHaveAttribute("contenteditable", "true");
}

test.describe("E2E-07 Real-Time Collaboration", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(skipIfNotWeb(testInfo.project.name), "Collaboration is web-only");
  });

  test("syncs edits between two users", async ({ browser, page }, testInfo) => {
    const runId = getRunId(testInfo, "collab");
    const userB = buildTestUser(runId, "collab-b");

    const convexUrl =
      process.env.VITE_CONVEX_URL ||
      process.env.PLAYWRIGHT_CONVEX_URL ||
      process.env.CONVEX_URL ||
      "https://convex.rhei.team";
    const baseURL = process.env.PLAYWRIGHT_TAURI_URL ?? "http://localhost:1420";

    const contextB = await browser.newContext({ baseURL });
    const pageB = await contextB.newPage();

    await signInE2E(pageB, { convexUrl, user: userB });

    const convexA = await getConvexHelpers(page);
    const convexB = await getConvexHelpers(pageB);

    const projectId = await convexA.createProject({
      name: `E2E/Collab/${runId}`,
    });

    const documentId = await convexA.createDocument({
      projectId,
      type: "chapter",
      title: `Collab Doc ${runId}`,
      contentText: "",
    });

    await convexA.addProjectMember({
      projectId,
      userId: convexB.userId,
      role: "editor",
    });

    await openProjectAndDocument(page, {
      projectId: projectId as string,
      documentId: documentId as string,
    });
    await openProjectAndDocument(pageB, {
      projectId: projectId as string,
      documentId: documentId as string,
    });

    const editorA = await resolveEditor(page);
    const editorB = await resolveEditor(pageB);

    await waitForEditorReady(page, editorA);
    await waitForEditorReady(pageB, editorB);

    await editorA.editor.click();
    await editorA.editor.type(`Hello from A ${runId}`);

    await expect(editorB.editor).toContainText(`Hello from A ${runId}`);

    const cursorLabelId = `remote-cursor-label-${convexA.userId}`;
    const remoteCursorLabel = editorB.frame
      ? editorB.frame.getByTestId(cursorLabelId)
      : pageB.getByTestId(cursorLabelId);
    await expect(remoteCursorLabel).toBeVisible();
  });
});
