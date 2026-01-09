import { chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir } from "fs/promises";
import { buildTestUser, signInUI, signUpUI } from "./fixtures/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const expoBaseURL = process.env.PLAYWRIGHT_EXPO_URL ?? "http://localhost:19006";
const tauriBaseURL = process.env.PLAYWRIGHT_TAURI_URL ?? "http://localhost:1420";
const webBaseURL = process.env.PLAYWRIGHT_WEB_URL;

const authDir = path.join(__dirname, "..", ".playwright", ".auth");
const expoStorageState = path.join(authDir, "expo-web.json");
const tauriStorageState = path.join(authDir, "tauri-web.json");
const webStorageState = path.join(authDir, "web-spa.json");

async function createStorageState(args: {
  baseURL: string;
  storagePath: string;
  mode: "signup" | "signin";
  user: { email: string; password: string; name?: string };
}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: args.baseURL });
  const page = await context.newPage();

  try {
    if (args.mode === "signup") {
      try {
        await signUpUI(page, args.user);
      } catch (error) {
        await signInUI(page, args.user);
      }
    } else {
      await signInUI(page, args.user);
    }

    await context.storageState({ path: args.storagePath });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  const runId = process.env.PLAYWRIGHT_RUN_ID ?? `${Date.now()}`;
  const user = buildTestUser(runId, "seed");

  const targetEnv = process.env.PLAYWRIGHT_TARGETS;
  const targets = new Set(
    targetEnv
      ? targetEnv.split(",").map((target) => target.trim()).filter(Boolean)
      : ["expo-web", "tauri-web", ...(webBaseURL ? ["web-spa"] : [])]
  );

  await mkdir(authDir, { recursive: true });

  if (targets.has("expo-web")) {
    await createStorageState({
      baseURL: expoBaseURL,
      storagePath: expoStorageState,
      mode: "signup",
      user,
    });
  }

  if (targets.has("tauri-web")) {
    await createStorageState({
      baseURL: tauriBaseURL,
      storagePath: tauriStorageState,
      mode: "signup",
      user,
    });
  }

  if (targets.has("web-spa") && webBaseURL) {
    await createStorageState({
      baseURL: webBaseURL,
      storagePath: webStorageState,
      mode: "signup",
      user,
    });
  }
}
