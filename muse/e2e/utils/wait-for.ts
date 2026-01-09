import type { Page } from "@playwright/test";

export async function waitForCondition<T>(
  fn: () => Promise<T | boolean>,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const intervalMs = options?.intervalMs ?? 500;
  const start = Date.now();

  while (true) {
    const result = await fn();
    if (result) {
      return result as T;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error("waitForCondition timed out");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function waitForUrl(
  page: Page,
  predicate: string | RegExp,
  timeoutMs = 10_000
) {
  await page.waitForURL(predicate, { timeout: timeoutMs });
}

export async function waitForConvexDocumentText(
  convex: { getDocument: (id: string) => Promise<{ contentText?: string | null } | null> },
  documentId: string,
  expectedSubstring: string,
  timeoutMs = 20_000
) {
  return waitForCondition(async () => {
    const doc = await convex.getDocument(documentId);
    if (!doc?.contentText) {
      return false;
    }
    return doc.contentText.includes(expectedSubstring);
  }, { timeoutMs });
}
