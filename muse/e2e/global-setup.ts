import { chromium } from "@playwright/test";
import path from "path";
import { mkdir } from "fs/promises";
import { buildTestUser, getE2EAuthTokens, setAuthStateForE2E } from "./fixtures/auth";
import { getRunId } from "./utils/run-id";

const expoBaseURL = process.env.PLAYWRIGHT_EXPO_URL ?? "http://localhost:19006";
const tauriBaseURL = process.env.PLAYWRIGHT_TAURI_URL ?? "http://localhost:1420";

const authDir = path.join(__dirname, "..", ".playwright", ".auth");
const expoStorageState = path.join(authDir, "expo-web.json");
const tauriStorageState = path.join(authDir, "tauri-web.json");

async function createStorageState(args: {
  baseURL: string;
  storagePath: string;
  user: { email: string; name?: string };
  convexUrl: string;
}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: args.baseURL });

  try {
    const authTokens = await getE2EAuthTokens({ convexUrl: args.convexUrl, user: args.user });
    await setAuthStateForE2E(context, {
      convexUrl: args.convexUrl,
      email: args.user.email,
      name: args.user.name,
      ...authTokens,
    });

    await context.storageState({ path: args.storagePath });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  const runId = getRunId();
  const user = buildTestUser(runId, "seed");
  const defaultConvexUrl =
    process.env.PLAYWRIGHT_CONVEX_URL ||
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    process.env.VITE_CONVEX_URL ||
    "https://convex.rhei.team";

  const targetEnv = process.env.PLAYWRIGHT_TARGETS;
  const targets = new Set(
    targetEnv
      ? targetEnv.split(",").map((target) => target.trim()).filter(Boolean)
      : ["expo-web", "tauri-web"]
  );

  await mkdir(authDir, { recursive: true });

  if (targets.has("expo-web")) {
    await createStorageState({
      baseURL: expoBaseURL,
      storagePath: expoStorageState,
      user,
      convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL || defaultConvexUrl,
    });
  }

  if (targets.has("tauri-web")) {
    await createStorageState({
      baseURL: tauriBaseURL,
      storagePath: tauriStorageState,
      user,
      convexUrl: process.env.VITE_CONVEX_URL || defaultConvexUrl,
    });
  }

}
