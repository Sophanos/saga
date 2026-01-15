import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { expect, type Page, type BrowserContext } from "@playwright/test";

export type TestUser = {
  email: string;
  name?: string;
};

export function buildTestUser(runId: string, suffix?: string): TestUser {
  const safeRunId = runId.replace(/[^a-zA-Z0-9]/g, "");
  const tag = suffix ? `${safeRunId}-${suffix}` : safeRunId;
  return {
    email: `e2e+${tag}@example.com`,
    name: "E2E User",
  };
}

const apiAny = anyApi as any;

const E2E_SECRET =
  process.env.PLAYWRIGHT_E2E_SECRET ||
  process.env.E2E_TEST_SECRET ||
  "";

function requireE2ESecret(): string {
  if (!E2E_SECRET) {
    throw new Error("Missing E2E_TEST_SECRET for E2E auth bootstrap");
  }
  return E2E_SECRET;
}

function escapeNamespace(namespace: string): string {
  return namespace.replace(/[^a-zA-Z0-9]/g, "");
}

function buildConvexAuthKeys(convexUrl: string): { jwtKey: string; refreshTokenKey: string } {
  const ns = escapeNamespace(convexUrl);
  return {
    jwtKey: `__convexAuthJWT_${ns}`,
    refreshTokenKey: `__convexAuthRefreshToken_${ns}`,
  };
}

type E2EAuthStateParams = {
  convexUrl: string;
  email: string;
  name?: string;
  userId: string;
  sessionId: string;
  token: string;
  refreshToken: string;
};

function buildMythosAuthStorageValue(params: E2EAuthStateParams): string {
  const nowIso = new Date().toISOString();
  return JSON.stringify({
    state: {
      user: {
        id: params.userId,
        email: params.email,
        name: params.name,
        emailVerified: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      session: {
        id: params.sessionId,
        userId: params.userId,
        token: params.token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      isAuthenticated: true,
    },
    version: 0,
  });
}

export async function setAuthStateForE2E(context: BrowserContext, params: E2EAuthStateParams): Promise<void> {
  const { jwtKey, refreshTokenKey } = buildConvexAuthKeys(params.convexUrl);
  const mythosAuthValue = buildMythosAuthStorageValue(params);

  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(payload.jwtKey, payload.token);
      window.localStorage.setItem(payload.refreshTokenKey, payload.refreshToken);
      window.localStorage.setItem("mythos-auth", payload.mythosAuthValue);
    },
    { jwtKey, refreshTokenKey, token: params.token, refreshToken: params.refreshToken, mythosAuthValue }
  );
  await page.close();
}

export async function getE2EAuthTokens(params: { convexUrl: string; user: TestUser }): Promise<{
  userId: string;
  sessionId: string;
  token: string;
  refreshToken: string;
}> {
  const client = new ConvexHttpClient(params.convexUrl);
  return client.action(apiAny.e2e.signInForE2E, {
    secret: requireE2ESecret(),
    email: params.user.email,
    name: params.user.name,
  }) as Promise<{ userId: string; sessionId: string; token: string; refreshToken: string }>;
}

export async function signInE2E(page: Page, params: { convexUrl: string; user: TestUser }): Promise<void> {
  const tokens = await getE2EAuthTokens(params);
  await setAuthStateForE2E(page.context(), {
    convexUrl: params.convexUrl,
    email: params.user.email,
    name: params.user.name,
    ...tokens,
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

export async function signOutUI(page: Page) {
  await page.goto("/settings");
  await page.getByTestId("auth-sign-out").click();
  await page.waitForURL(/\/sign-in/);
  await expect(page.getByPlaceholder("Email")).toBeVisible();
}
