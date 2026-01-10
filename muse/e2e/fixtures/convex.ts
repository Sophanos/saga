import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { Page } from "@playwright/test";

type Id<TableName extends string> = string;

// Avoid pulling the generated API type graph into E2E fixtures.
const apiAny = anyApi as any;

const CONVEX_URL =
  process.env.PLAYWRIGHT_CONVEX_URL ||
  process.env.CONVEX_URL ||
  process.env.EXPO_PUBLIC_CONVEX_URL ||
  "https://convex.cascada.vision";

const E2E_SECRET =
  process.env.PLAYWRIGHT_E2E_SECRET ||
  process.env.E2E_TEST_SECRET ||
  "";

export async function getAuthTokenFromStorage(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem("mythos-auth");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.state?.session?.token ?? null;
    } catch {
      return null;
    }
  });

  if (!token) {
    throw new Error("Missing auth token in mythos-auth storage");
  }

  return token;
}

export async function getConvexClient(page: Page) {
  const token = await getAuthTokenFromStorage(page);
  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(token);
  return client;
}

function requireE2ESecret(): string {
  if (!E2E_SECRET) {
    throw new Error("Missing E2E_TEST_SECRET for E2E harness calls");
  }
  return E2E_SECRET;
}

function decodeJwtSubject(token: string): string {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid auth token format");
  }
  const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
  const subject = payload.sub ?? payload.userId ?? payload.subject;
  if (!subject || typeof subject !== "string") {
    throw new Error("Unable to resolve user id from auth token");
  }
  return subject;
}

export async function getUserIdFromStorage(page: Page): Promise<string> {
  const token = await getAuthTokenFromStorage(page);
  return decodeJwtSubject(token);
}

export async function getConvexHelpers(page: Page) {
  const client = await getConvexClient(page);
  const token = await getAuthTokenFromStorage(page);
  const userId = decodeJwtSubject(token);

  return {
    userId,
    createProject: async (args: { name: string; description?: string }) =>
      client.mutation(apiAny.projects.create, {
        name: args.name,
        description: args.description,
      }),
    deleteProject: async (projectId: Id<"projects">) =>
      client.mutation(apiAny.projects.remove, { id: projectId }),
    createDocument: async (args: {
      projectId: Id<"projects">;
      type: string;
      title: string;
      contentText?: string;
    }) =>
      client.mutation(apiAny.documents.create, {
        projectId: args.projectId,
        type: args.type,
        title: args.title,
        content: { type: "doc", content: [{ type: "paragraph" }] },
        contentText: args.contentText ?? "",
      }),
    updateDocumentText: async (args: { id: Id<"documents">; contentText: string }) =>
      client.mutation(apiAny.documents.update, {
        id: args.id,
        contentText: args.contentText,
      }),
    getDocument: async (id: Id<"documents">) =>
      client.query(apiAny.documents.get, { id }),
    listEntities: async (projectId: Id<"projects">) =>
      client.query(apiAny.entities.list, { projectId, limit: 200 }),
    listRelationships: async (projectId: Id<"projects">) =>
      client.query(apiAny.relationships.list, { projectId, limit: 200 }),
    createEntity: async (args: {
      projectId: Id<"projects">;
      name: string;
      type: string;
      aliases?: string[];
      properties?: Record<string, unknown>;
    }) =>
      client.mutation(apiAny.entities.create, {
        projectId: args.projectId,
        name: args.name,
        type: args.type,
        aliases: args.aliases ?? [],
        properties: args.properties ?? {},
      }),
    createRelationship: async (args: {
      projectId: Id<"projects">;
      sourceId: Id<"entities">;
      targetId: Id<"entities">;
      type: string;
      bidirectional?: boolean;
    }) =>
      client.mutation(apiAny.relationships.create, {
        projectId: args.projectId,
        sourceId: args.sourceId,
        targetId: args.targetId,
        type: args.type,
        bidirectional: args.bidirectional ?? false,
      }),
    addProjectMember: async (args: {
      projectId: Id<"projects">;
      userId: string;
      role?: "owner" | "editor" | "viewer";
    }) =>
      client.mutation(apiAny.collaboration.addProjectMember, {
        projectId: args.projectId,
        userId: args.userId,
        role: args.role ?? "editor",
      }),
    detectAndPersist: async (args: {
      projectId: Id<"projects">;
      text: string;
      minConfidence?: number;
    }) =>
      client.action(
        apiAny.ai.detectAndPersist.detectAndPersistEntitiesPublic,
        args
      ),
    setDetectionFixture: async (args: {
      projectId: Id<"projects">;
      entities: Array<{
        name: string;
        type: string;
        aliases?: string[];
        confidence?: number;
        properties?: Record<string, unknown>;
      }>;
      key?: string;
    }) =>
      client.mutation(apiAny.e2e.setDetectionFixture, {
        secret: requireE2ESecret(),
        projectId: args.projectId,
        key: args.key,
        entities: args.entities.map((entity) => ({
          name: entity.name,
          type: entity.type,
          aliases: entity.aliases ?? [],
          confidence: entity.confidence ?? 0.99,
          properties: entity.properties ?? {},
        })),
      }),
    clearDetectionFixture: async (args: { projectId: Id<"projects">; key?: string }) =>
      client.mutation(apiAny.e2e.clearDetectionFixture, {
        secret: requireE2ESecret(),
        projectId: args.projectId,
        key: args.key,
      }),
    setSagaScript: async (args: {
      projectId: Id<"projects">;
      userId: string;
      steps: unknown[];
      scenario?: string;
    }) =>
      client.mutation(apiAny.e2e.setSagaScript, {
        secret: requireE2ESecret(),
        projectId: args.projectId,
        userId: args.userId,
        steps: args.steps,
        scenario: args.scenario,
      }),
    processEmbeddingJobsNow: async (args?: { batchSize?: number }) =>
      client.action(apiAny.e2e.processEmbeddingJobsNow, {
        secret: requireE2ESecret(),
        batchSize: args?.batchSize,
      }),
    retrieveRagContext: async (args: { projectId: Id<"projects">; query: string }) =>
      client.action(apiAny.e2e.retrieveRagContext, {
        secret: requireE2ESecret(),
        projectId: args.projectId,
        query: args.query,
      }),
    upsertSubscription: async (args: {
      userId: string;
      status: "active" | "trialing" | "past_due" | "canceled" | "expired" | "paused" | "grace_period";
      productId: string;
      entitlements: string[];
    }) =>
      client.mutation(apiAny.e2e.upsertSubscription, {
        secret: requireE2ESecret(),
        userId: args.userId,
        status: args.status,
        productId: args.productId,
        entitlements: args.entitlements,
      }),
    getUserTierForE2E: async (args: { userId: string }) =>
      client.query(apiAny.e2e.getUserTierForE2E, {
        secret: requireE2ESecret(),
        userId: args.userId,
      }),
    canAccessFeatureForE2E: async (args: { userId: string; feature: string }) =>
      client.query(apiAny.e2e.canAccessFeatureForE2E, {
        secret: requireE2ESecret(),
        userId: args.userId,
        feature: args.feature,
      }),
  };
}
