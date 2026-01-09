import { ConvexHttpClient } from "convex/node";
import type { Page } from "@playwright/test";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Convex API types may not include new actions until codegen runs.
// @ts-ignore
const apiAny: any = api;

const CONVEX_URL =
  process.env.PLAYWRIGHT_CONVEX_URL ||
  process.env.CONVEX_URL ||
  process.env.EXPO_PUBLIC_CONVEX_URL ||
  "https://convex.cascada.vision";

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

export async function getConvexHelpers(page: Page) {
  const client = await getConvexClient(page);

  return {
    createProject: async (args: { name: string; description?: string }) =>
      client.mutation(api.projects.create, {
        name: args.name,
        description: args.description,
      }),
    deleteProject: async (projectId: Id<"projects">) =>
      client.mutation(api.projects.remove, { id: projectId }),
    createDocument: async (args: {
      projectId: Id<"projects">;
      type: string;
      title: string;
    }) =>
      client.mutation(api.documents.create, {
        projectId: args.projectId,
        type: args.type,
        title: args.title,
        content: { type: "doc", content: [{ type: "paragraph" }] },
        contentText: "",
      }),
    getDocument: async (id: Id<"documents">) =>
      client.query(api.documents.get, { id }),
    listEntities: async (projectId: Id<"projects">) =>
      client.query(api.entities.list, { projectId, limit: 200 }),
    detectAndPersist: async (args: {
      projectId: Id<"projects">;
      text: string;
      minConfidence?: number;
    }) =>
      client.action(
        apiAny.ai.detectAndPersist.detectAndPersistEntitiesPublic,
        args
      ),
  };
}
