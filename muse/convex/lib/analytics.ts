/**
 * Server-side PostHog analytics using native fetch
 * Compatible with Convex's serverless environment
 */

const POSTHOG_HOST = process.env["POSTHOG_HOST"] || 'https://posthog.rhei.team';
const POSTHOG_API_KEY = process.env["POSTHOG_API_KEY"];

interface PostHogEvent {
  event: string;
  distinct_id: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

async function sendToPostHog(events: PostHogEvent[]): Promise<void> {
  if (!POSTHOG_API_KEY) return;

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        batch: events.map((e) => ({
          ...e,
          timestamp: e.timestamp || new Date().toISOString(),
          properties: {
            ...e.properties,
            $lib: 'convex-server',
          },
        })),
      }),
    });
  } catch (error) {
    console.error('[analytics] Failed to send events to PostHog:', error);
  }
}

export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  await sendToPostHog([{ event, distinct_id: distinctId, properties }]);
}

export async function trackServerEvents(
  distinctId: string,
  events: Array<{ event: string; properties?: Record<string, unknown> }>
): Promise<void> {
  await sendToPostHog(
    events.map(({ event, properties }) => ({
      event,
      distinct_id: distinctId,
      properties,
    }))
  );
}

// Typed server event helpers
export const ServerAgentEvents = {
  streamStarted: (userId: string, projectId: string, threadId: string, model?: string) =>
    trackServerEvent(userId, 'server_agent_stream_started', { project_id: projectId, thread_id: threadId, model }),

  ragContextRetrieved: (userId: string, documentsFound: number, entitiesFound: number, memoriesFound: number) =>
    trackServerEvent(userId, 'server_rag_context_retrieved', {
      documents_found: documentsFound,
      entities_found: entitiesFound,
      memories_found: memoriesFound,
    }),
  ragRetrievalMetrics: (
    userId: string,
    metrics: {
      projectId: string;
      scope: string;
      denseCandidates: number;
      lexicalCandidates: number;
      fusedCandidates: number;
      rerankCandidates: number;
      documentsReturned: number;
      entitiesReturned: number;
      memoriesReturned: number;
      embedMs: number;
      qdrantMs: number;
      rerankMs: number;
      chunkMs: number;
      totalMs: number;
    }
  ) =>
    trackServerEvent(userId, 'server_rag_retrieval_metrics', {
      project_id: metrics.projectId,
      scope: metrics.scope,
      dense_candidates: metrics.denseCandidates,
      lexical_candidates: metrics.lexicalCandidates,
      fused_candidates: metrics.fusedCandidates,
      rerank_candidates: metrics.rerankCandidates,
      documents_returned: metrics.documentsReturned,
      entities_returned: metrics.entitiesReturned,
      memories_returned: metrics.memoriesReturned,
      embed_ms: metrics.embedMs,
      qdrant_ms: metrics.qdrantMs,
      rerank_ms: metrics.rerankMs,
      chunk_ms: metrics.chunkMs,
      total_ms: metrics.totalMs,
    }),

  streamCompleted: (userId: string, durationMs: number, tokens?: number) =>
    trackServerEvent(userId, 'server_agent_stream_completed', { duration_ms: durationMs, tokens }),

  streamFailed: (userId: string, error: string) =>
    trackServerEvent(userId, 'server_agent_stream_failed', { error }),
};

export const ServerUsageEvents = {
  documentCreated: (userId: string, projectId: string, documentType: string) =>
    trackServerEvent(userId, 'server_document_created', { project_id: projectId, document_type: documentType }),

  entityCreated: (userId: string, projectId: string, entityType: string) =>
    trackServerEvent(userId, 'server_entity_created', { project_id: projectId, entity_type: entityType }),

  exportCompleted: (userId: string, projectId: string, format: string) =>
    trackServerEvent(userId, 'server_export_completed', { project_id: projectId, format }),
};
