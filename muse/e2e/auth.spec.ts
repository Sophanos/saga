import { test, expect } from "@playwright/test";
import { buildTestUser, signInE2E, signOutUI } from "./fixtures/auth";
import { getRunId } from "./utils/run-id";

const emptyStorageState = { cookies: [], origins: [] };

function resolveConvexUrl(projectName: string): string {
  const base =
    process.env.PLAYWRIGHT_CONVEX_URL ||
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    process.env.VITE_CONVEX_URL ||
    "https://convex.rhei.team";

  if (projectName === "expo-web") {
    return process.env.EXPO_PUBLIC_CONVEX_URL || base;
  }

  if (projectName === "tauri-web") {
    return process.env.VITE_CONVEX_URL || base;
  }

  return base;
}

test.describe("auth", () => {
  test.use({ storageState: emptyStorageState });

  test("redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("E2E bootstrap signs in successfully", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "signin");
    const user = buildTestUser(runId);
    await signInE2E(page, { convexUrl: resolveConvexUrl(testInfo.project.name), user });
    await expect(page.getByText("Welcome to Mythos")).toBeVisible();
  });

  test("sign-out returns to sign-in", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "signout");
    const user = buildTestUser(runId);

    await signInE2E(page, { convexUrl: resolveConvexUrl(testInfo.project.name), user });
    await signOutUI(page);

    await expect(page).toHaveURL(/\/sign-in/);
  });
});
