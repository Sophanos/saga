import { expect, type Page } from "@playwright/test";

export type TestUser = {
  email: string;
  password: string;
  name?: string;
};

const DEFAULT_PASSWORD =
  process.env.PLAYWRIGHT_E2E_PASSWORD ?? "E2ePass!123";

export function buildTestUser(runId: string, suffix?: string): TestUser {
  const safeRunId = runId.replace(/[^a-zA-Z0-9]/g, "");
  const tag = suffix ? `${safeRunId}-${suffix}` : safeRunId;
  return {
    email: `e2e+${tag}@example.com`,
    password: DEFAULT_PASSWORD,
    name: "E2E User",
  };
}

export async function signUpUI(page: Page, user: TestUser) {
  await page.goto("/sign-up");
  await page.getByPlaceholder("Name (optional)").fill(user.name ?? "");
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByPlaceholder("Confirm Password").fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await page.waitForURL(/\/$/);
  await expect(page.getByText("Welcome to Mythos")).toBeVisible();
}

export async function signInUI(page: Page, user: TestUser) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("Email").fill(user.email);
  await page.getByPlaceholder("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL(/\/$/);
  await expect(page.getByText("Welcome to Mythos")).toBeVisible();
}

export async function signOutUI(page: Page) {
  await page.goto("/settings");
  await page.getByTestId("auth-sign-out").click();
  await page.waitForURL(/\/sign-in/);
  await expect(page.getByPlaceholder("Email")).toBeVisible();
}
