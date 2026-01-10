import { test, expect, type Page } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";
import { getRunId } from "./utils/run-id";

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
  const openButton = page.getByTestId("chat-open");
  await expect(openButton).toBeVisible();
  await openButton.click();
  await expect(page.getByTestId("chat-input")).toBeVisible();
}

test.describe("E2E-05 AI Agent Chat + Streaming", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(skipIfNotWeb(testInfo.project.name), "AI sidebar is web-only");
  });
  test.skip(!hasE2EHarness, "E2E harness not configured");

  test("streams assistant response", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "chat");
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

  test("renders tool approval request", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "chat-approval");
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
          responseType: "text",
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

  test("resumes after tool response", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "chat-resume");
    const convex = await getConvexHelpers(page);

    const projectId = await convex.createProject({
      name: `E2E/ChatResume/${runId}`,
    });

    await convex.createDocument({
      projectId,
      type: "chapter",
      title: `Chat Resume Doc ${runId}`,
      contentText: "Chat seed",
    });

    await convex.setSagaScript({
      projectId,
      userId: convex.userId,
      steps: [
        buildToolCallStep("call-resume", "ask_question", {
          question: "Choose Elena's route.",
          detail: "We will continue after you answer.",
          responseType: "text",
        }),
      ],
    });

    await openProject(page, projectId as string);
    await expect(page.getByTestId("editor-surface")).toBeVisible();

    await openChat(page);
    await page.getByTestId("chat-input").fill("Let's continue");
    await page.getByTestId("chat-send").click();

    await expect(page.getByTestId("tool-approval-request")).toBeVisible();

    await convex.setSagaScript({
      projectId,
      userId: convex.userId,
      steps: [buildTextStep("Continuing after approval")],
    });

    await page.getByTestId("tool-approval-input").fill("She takes the forest path.");
    await page.getByTestId("tool-approval-accept").click();

    const assistantMessage = page.getByTestId("chat-message-assistant").last();
    await expect(assistantMessage).toContainText("Continuing after approval");
  });
});
