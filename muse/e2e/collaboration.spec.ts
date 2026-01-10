import { test, expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { buildTestUser, signUpUI } from "./fixtures/auth";
import { getConvexHelpers } from "./fixtures/convex";
import { getRunId } from "./utils/run-id";

function skipIfNotWeb(projectName: string): boolean {
  return projectName !== "tauri-web";
}

async function openProject(page: Page, projectId: string): Promise<void> {
  await page.addInitScript((id: string) => {
    window.localStorage.setItem("mythos:lastProjectId", id);
  }, projectId);
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

test.describe("E2E-07 Real-Time Collaboration", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(skipIfNotWeb(testInfo.project.name), "Collaboration is web-only");
  });

  test("syncs edits between two users", async ({ browser, page }, testInfo) => {
    const runId = getRunId(testInfo, "collab");
    const userB = buildTestUser(runId, "collab-b");

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await signUpUI(pageB, userB);

    const convexA = await getConvexHelpers(page);
    const convexB = await getConvexHelpers(pageB);

    const projectId = await convexA.createProject({
      name: `E2E/Collab/${runId}`,
    });

    await convexA.createDocument({
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

    await openProject(page, projectId as string);
    await openProject(pageB, projectId as string);

    const editorA = await resolveEditor(page);
    const editorB = await resolveEditor(pageB);

    await editorA.editor.click();
    await editorA.editor.type(`Hello from A ${runId}`);

    await expect(editorB.editor).toContainText(`Hello from A ${runId}`);

    if (editorB.frame) {
      await expect(editorB.frame.locator(".remote-cursor__label")).toHaveCount(1);
    }
  });
});
