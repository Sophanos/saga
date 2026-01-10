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

type ConvexDocument = {
  contentText?: string | null;
  updatedAt?: number | null;
  wordCount?: number | null;
};

export async function waitForConvexDocumentText(
  convex: { getDocument: (id: string) => Promise<ConvexDocument | null> },
  documentId: string,
  expectedSubstring: string,
  timeoutMs = 20_000
): Promise<ConvexDocument> {
  return waitForCondition(async () => {
    const doc = await convex.getDocument(documentId);
    if (!doc?.contentText) {
      return false;
    }
    if (!doc.contentText.includes(expectedSubstring)) {
      return false;
    }
    return doc;
  }, { timeoutMs });
}

export async function waitForConvexDocumentUpdatedAt(
  convex: { getDocument: (id: string) => Promise<ConvexDocument | null> },
  documentId: string,
  minUpdatedAt: number,
  timeoutMs = 20_000
): Promise<ConvexDocument> {
  return waitForCondition(async () => {
    const doc = await convex.getDocument(documentId);
    if (!doc?.updatedAt) {
      return false;
    }
    if (doc.updatedAt <= minUpdatedAt) {
      return false;
    }
    return doc;
  }, { timeoutMs });
}
