import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const expoBaseURL = process.env.PLAYWRIGHT_EXPO_URL ?? "http://localhost:19006";
const tauriBaseURL = process.env.PLAYWRIGHT_TAURI_URL ?? "http://localhost:1420";

const authDir = path.join(__dirname, "..", ".playwright", ".auth");
const expoStorageState = path.join(authDir, "expo-web.json");
const tauriStorageState = path.join(authDir, "tauri-web.json");

const shouldStartServers =
  process.env.PLAYWRIGHT_START_SERVERS === "true" || process.env.CI === "true";

const targetEnv = process.env.PLAYWRIGHT_TARGETS;
const targets = new Set(
  targetEnv
    ? targetEnv.split(",").map((target) => target.trim()).filter(Boolean)
    : ["expo-web", "tauri-web"]
);

const webServers = shouldStartServers
  ? [
      targets.has("expo-web")
        ? {
            command: "bun run dev:expo:web",
            url: expoBaseURL,
            reuseExistingServer: process.env.CI !== "true",
            timeout: 120_000,
            cwd: path.join(__dirname, ".."),
          }
        : null,
      targets.has("tauri-web")
        ? {
            command: "bun run --filter @mythos/tauri dev",
            url: tauriBaseURL,
            reuseExistingServer: process.env.CI !== "true",
            timeout: 120_000,
            cwd: path.join(__dirname, ".."),
          }
        : null,
    ].filter(Boolean)
  : undefined;

export default defineConfig({
  testDir: __dirname,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI === "true" ? 1 : 0,
  reporter: [
    ["html", { outputFolder: "../playwright-report", open: "never" }],
    ["list"],
  ],
  outputDir: "../test-results",
  globalSetup: path.join(__dirname, "global-setup"),
  webServer: webServers,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    testIdAttribute: "data-testid",
  },
  projects: [
    {
      name: "expo-web",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: expoBaseURL,
        storageState: expoStorageState,
      },
    },
    {
      name: "tauri-web",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: tauriBaseURL,
        storageState: tauriStorageState,
      },
    },
  ],
});
