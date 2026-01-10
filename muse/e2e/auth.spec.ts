import { test, expect } from "@playwright/test";
import { buildTestUser, signInUI, signOutUI, signUpUI } from "./fixtures/auth";
import { getRunId } from "./utils/run-id";

const emptyStorageState = { cookies: [], origins: [] };

test.describe("auth", () => {
  test.use({ storageState: emptyStorageState });

  test("redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-up creates an account", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "signup");
    const user = buildTestUser(runId);

    await signUpUI(page, user);
    await expect(page.getByText("Welcome to Mythos")).toBeVisible();
  });

  test("sign-in works with valid credentials", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "signin");
    const user = buildTestUser(runId);

    await signUpUI(page, user);
    await signOutUI(page);
    await signInUI(page, user);

    await expect(page.getByText("Welcome to Mythos")).toBeVisible();
  });

  test("sign-out returns to sign-in", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "signout");
    const user = buildTestUser(runId);

    await signUpUI(page, user);
    await signOutUI(page);

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("invalid credentials show an error", async ({ page }, testInfo) => {
    const runId = getRunId(testInfo, "invalid");
    const user = buildTestUser(runId);

    await signUpUI(page, user);
    await signOutUI(page);

    await page.goto("/sign-in");
    await page.getByPlaceholder("Email").fill(user.email);
    await page.getByPlaceholder("Password").fill("wrong-password");
    await page.getByTestId("auth-sign-in").click();

    await expect(page.getByTestId("auth-error")).toBeVisible();
  });
});
