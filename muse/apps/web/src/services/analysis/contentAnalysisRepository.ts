import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { authClient } from "../../lib/auth";
import type { AnalysisRecord } from "../../stores/history";
import type { SceneMetrics } from "@mythos/core";

const CONVEX_URL = import.meta.env["VITE_CONVEX_URL"] || "https://convex.cascada.vision";

let cachedClient: ConvexHttpClient | null = null;
let cachedToken: string | null = null;

async function getConvexClient(): Promise<ConvexHttpClient> {
  if (!cachedClient) {
    cachedClient = new ConvexHttpClient(CONVEX_URL);
  }

  const token = await authClient.$fetch("/api/auth/convex-token", { method: "GET" });
  const nextToken = token?.data?.token ?? null;
  if (!nextToken) {
    throw new Error("Missing Convex auth token");
  }

  if (cachedToken !== nextToken) {
    cachedClient.setAuth(nextToken);
    cachedToken = nextToken;
  }

  return cachedClient;
}

/**
 * Input for persisting an analysis record to the database
 */
export interface PersistAnalysisInput {
  projectId: string;
  documentId?: string;
  sceneId: string;
  metrics: SceneMetrics;
  wordCount?: number;
}

/**
 * Maps database row to AnalysisRecord
 */
function mapRowToAnalysisRecord(row: {
  _id: Id<"analysisRecords">;
  sceneId: string;
  analyzedAt: number;
  metrics: SceneMetrics;
}): AnalysisRecord {
  return {
    timestamp: new Date(row.analyzedAt),
    sceneId: row.sceneId,
    metrics: row.metrics,
  };
}

/**
 * Fetches analysis history for a project from the database
 *
 * @param projectId - The project ID to fetch history for
 * @param limit - Maximum number of records to fetch (default: 100)
 * @returns Array of AnalysisRecord sorted by timestamp descending
 */
export async function fetchAnalysisHistory(
  projectId: string,
  limit: number = 100
): Promise<AnalysisRecord[]> {
  const client = await getConvexClient();
  const data = await client.query(api.analysis.listByProject, {
    projectId: projectId as Id<"projects">,
    limit,
  });

  return (data ?? []).map(mapRowToAnalysisRecord);
}

/**
 * Persists an analysis record to the database
 *
 * @param input - The analysis data to persist
 */
export async function persistAnalysisRecord(input: PersistAnalysisInput): Promise<void> {
  const { projectId, documentId, sceneId, metrics, wordCount } = input;
  const client = await getConvexClient();
  await client.mutation(api.analysis.insert, {
    projectId: projectId as Id<"projects">,
    documentId: documentId ? (documentId as Id<"documents">) : undefined,
    sceneId,
    metrics,
    wordCount,
  });
}

/**
 * Fetches analysis history for a specific document
 *
 * @param projectId - The project ID
 * @param documentId - The document ID
 * @param limit - Maximum number of records to fetch
 * @returns Array of AnalysisRecord sorted by timestamp descending
 */
export async function fetchDocumentAnalysisHistory(
  _projectId: string,
  documentId: string,
  limit: number = 50
): Promise<AnalysisRecord[]> {
  const client = await getConvexClient();
  const data = await client.query(api.analysis.listByDocument, {
    documentId: documentId as Id<"documents">,
    limit,
  });

  return (data ?? []).map(mapRowToAnalysisRecord);
}
