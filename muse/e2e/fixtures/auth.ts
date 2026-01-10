import { expect, type Locator, type Page } from "@playwright/test";

export type TestUser = {
  email: string;
  password: string;
  name?: string;
};

const DEFAULT_PASSWORD =
  process.env.PLAYWRIGHT_E2E_PASSWORD ?? "E2ePass!123";

function getEmailField(page: Page): Locator {
  return page
    .getByTestId("auth-email")
    .or(page.getByLabel("Email"))
    .or(page.getByPlaceholder("Email"))
    .or(page.getByPlaceholder("Email address"))
    .or(page.getByPlaceholder("you@example.com"));
}

function getPasswordField(page: Page): Locator {
  return page
    .getByTestId("auth-password")
    .or(page.getByLabel("Password"))
    .or(page.getByPlaceholder("Password"))
    .or(page.getByPlaceholder("Enter your password"));
}

function getNameField(page: Page): Locator {
  return page
    .getByTestId("auth-name")
    .or(page.getByPlaceholder("Name (optional)"))
    .or(page.getByPlaceholder("Your name"));
}

function getConfirmPasswordField(page: Page): Locator {
  return page
    .getByTestId("auth-password-confirm")
    .or(page.getByPlaceholder("Confirm Password"));
}

async function ensureAuthRoute(page: Page, paths: string[]): Promise<void> {
  for (const path of paths) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    try {
      await getEmailField(page).first().waitFor({ state: "visible", timeout: 8_000 });
      return;
    } catch {
      // Try next path.
    }
  }
}

export function buildTestUser(runId: string, suffix?: string): TestUser {
  const safeRunId = runId.replace(/[^a-zA-Z0-9]/g, "");
  const tag = suffix ? `${safeRunId}-${suffix}` : safeRunId;
  return {
    email: `e2e+${tag}@example.com`,
    password: DEFAULT_PASSWORD,
    name: "E2E User",
  };
}

async function waitForAuthToken(page: Page) {
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("mythos-auth");
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.state?.session?.token);
    } catch {
      return false;
    }
  });
}

export async function signUpUI(page: Page, user: TestUser) {
  await ensureAuthRoute(page, ["/sign-up", "/signup"]);
  await expect(getEmailField(page)).toBeVisible({ timeout: 20_000 });
  await getNameField(page).fill(user.name ?? "");
  await getEmailField(page).fill(user.email);
  await getPasswordField(page).fill(user.password);
  const confirmField = getConfirmPasswordField(page);
  if (await confirmField.count()) {
    await confirmField.fill(user.password);
  }
  const signUpButton = page
    .getByTestId("auth-sign-up")
    .or(page.getByRole("button", { name: /create account/i }));
  await signUpButton.click();

  await waitForAuthToken(page);
}

export async function signInUI(page: Page, user: TestUser) {
  await ensureAuthRoute(page, ["/sign-in", "/login"]);
  await expect(getEmailField(page)).toBeVisible({ timeout: 20_000 });
  await getEmailField(page).fill(user.email);
  await getPasswordField(page).fill(user.password);
  const signInButton = page
    .getByTestId("auth-sign-in")
    .or(page.getByRole("button", { name: /sign in/i }));
  await signInButton.click();

  await waitForAuthToken(page);
}

export async function signOutUI(page: Page) {
  await page.goto("/settings");
  await page.getByTestId("auth-sign-out").click();
  await page.waitForURL(/\/sign-in/);
  await expect(page.getByPlaceholder("Email")).toBeVisible();
}
