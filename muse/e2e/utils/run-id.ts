import type { TestInfo } from "@playwright/test";

function sanitizeRunId(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "");
}

export function getRunId(testInfo?: TestInfo, suffix?: string): string {
  const base = process.env.PLAYWRIGHT_RUN_ID ?? `${Date.now()}`;
  const parts = [base];

  if (testInfo) {
    parts.push(testInfo.project.name, String(testInfo.parallelIndex));
  }

  if (suffix) {
    parts.push(suffix);
  }

  return sanitizeRunId(parts.filter(Boolean).join("-"));
}
