import { test, expect, type Page } from "@playwright/test";
import { getConvexHelpers } from "./fixtures/convex";

const hasE2ESecret = !!(process.env.PLAYWRIGHT_E2E_SECRET || process.env.E2E_TEST_SECRET);

function skipIfNotWeb(projectName: string): boolean {
  return projectName !== "tauri-web";
}

async function openProject(page: Page, projectId: string): Promise<void> {
  await page.addInitScript((id: string) => {
    window.localStorage.setItem("mythos:lastProjectId", id);
  }, projectId);
  await page.goto("/");
}

test.describe("E2E-08 Billing + Tier Limits", () => {
  test("renders billing usage from mocked edge response", async ({ page }) => {
    test.skip(skipIfNotWeb(test.info().project.name), "Billing UI is web-only");

    const runId = `${Date.now()}`;
    const convex = await getConvexHelpers(page);

    const projectId = await convex.createProject({
      name: `E2E/Billing/${runId}`,
    });

    await convex.createDocument({
      projectId,
      type: "chapter",
      title: `Billing Doc ${runId}`,
      contentText: "Billing seed",
    });

    await page.route("**/api/billing-subscription", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          subscription: {
            tier: "pro",
            status: "active",
            currentPeriodEnd: new Date().toISOString(),
            cancelAtPeriodEnd: false,
          },
          usage: {
            tokensUsed: 120,
            tokensIncluded: 1000,
            tokensRemaining: 880,
            wordsWritten: 4321,
          },
        }),
      });
    });

    await openProject(page, projectId as string);
    await expect(page.getByTestId("editor-surface")).toBeVisible();

    await page.getByTestId("project-picker-toggle").click();
    await page.getByTestId("project-billing-button").click();

    await expect(page.getByTestId("billing-modal")).toBeVisible();
    await expect(page.getByTestId("billing-current-tier")).toHaveText("Pro");
    await expect(page.getByTestId("billing-tokens-remaining")).toContainText("880");
  });

  test("upserts subscription and reports tier", async ({ page }) => {
    test.skip(
      !hasE2ESecret || process.env.E2E_TEST_MODE !== "true",
      "E2E harness not configured"
    );
    const runId = `${Date.now()}`;
    const convex = await getConvexHelpers(page);

    await convex.upsertSubscription({
      userId: convex.userId,
      status: "active",
      productId: `pro-${runId}`,
      entitlements: ["pro"],
    });

    const tier = await convex.getUserTierForE2E({ userId: convex.userId });
    expect(tier).toBe("pro");
  });
});
