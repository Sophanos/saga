import { test, expect, type Page } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";

const hasE2EHarness =
  process.env.E2E_TEST_MODE === "true" &&
  !!(process.env.PLAYWRIGHT_E2E_SECRET || process.env.E2E_TEST_SECRET);

function skipIfNotWeb(projectName: string): boolean {
  return projectName !== "tauri-web";
}

function buildTextStep(text: string, id = "text-1"): { chunks: Array<Record<string, unknown>> } {
  const midpoint = Math.max(1, Math.floor(text.length / 2));
  return {
    chunks: [
      { type: "text-start", id },
      { type: "text-delta", id, delta: text.slice(0, midpoint) },
      { type: "text-delta", id, delta: text.slice(midpoint) },
      { type: "text-end", id },
    ],
  };
}

function buildToolCallStep(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>
): { chunks: Array<Record<string, unknown>> } {
  return {
    chunks: [
      {
        type: "tool-call",
        toolCallId,
        toolName,
        input: JSON.stringify(input),
      },
    ],
  };
}

async function openProject(page: Page, projectId: string): Promise<void> {
  await page.addInitScript((id: string) => {
    window.localStorage.setItem("mythos:lastProjectId", id);
  }, projectId);
  await page.goto("/");
}

async function openChat(page: Page): Promise<void> {
  await page.keyboard.press("Meta+/");
  await page.keyboard.press("Control+/");
  await expect(page.getByTestId("chat-input")).toBeVisible();
}

test.describe("E2E-05 AI Agent Chat + Streaming", () => {
  test.skip(({ project }) => skipIfNotWeb(project.name), "AI sidebar is web-only");
  test.skip(!hasE2EHarness, "E2E harness not configured");

  test("streams assistant response", async ({ page }) => {
    const runId = `${Date.now()}`;
    const convex = await getConvexHelpers(page);

    const projectId = await convex.createProject({
      name: `E2E/Chat/${runId}`,
    });

    await convex.createDocument({
      projectId,
      type: "chapter",
      title: `Chat Doc ${runId}`,
      contentText: "Chat seed",
    });

    await convex.setSagaScript({
      projectId,
      userId: convex.userId,
      steps: [buildTextStep("Hello from Saga")],
    });

    await openProject(page, projectId as string);
    await expect(page.getByTestId("editor-surface")).toBeVisible();

    await openChat(page);
    await page.getByTestId("chat-input").fill("Hello");
    await page.getByTestId("chat-send").click();

    const assistantMessage = page.getByTestId("chat-message-assistant").last();
    await expect(assistantMessage).toContainText("Hello from Saga");
  });

  test("renders tool approval request", async ({ page }) => {
    const runId = `${Date.now()}`;
    const convex = await getConvexHelpers(page);

    const projectId = await convex.createProject({
      name: `E2E/ChatApproval/${runId}`,
    });

    await convex.createDocument({
      projectId,
      type: "chapter",
      title: `Chat Approval Doc ${runId}`,
      contentText: "Chat seed",
    });

    await convex.setSagaScript({
      projectId,
      userId: convex.userId,
      steps: [
        buildToolCallStep("call-approval", "ask_question", {
          question: "Which path should Elena take?",
          detail: "Awaiting direction",
        }),
      ],
    });

    await openProject(page, projectId as string);
    await expect(page.getByTestId("editor-surface")).toBeVisible();

    await openChat(page);
    await page.getByTestId("chat-input").fill("Need guidance");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("tool-approval-request")).toBeVisible();
    await expect(page.getByTestId("tool-approval-request")).toContainText("Which path should Elena take?");
  });
});
