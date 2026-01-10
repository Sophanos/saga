/**
 * Convex HTTP Router
 *
 * Exposes HTTP endpoints for AI streaming and webhooks.
 * Endpoints are accessible at https://convex.cascada.vision/*
 *
 * Routes:
 * - POST /ai/saga - Main Saga agent (SSE streaming)
 * - POST /ai/chat - Simple chat (SSE streaming)
 * - POST /ai/detect - Entity detection (JSON response)
 * - POST /ai/lint - Consistency linting (JSON response)
 * - POST /billing-subscription - Subscription + usage snapshot (JSON response)
 * - GET /health - Health check
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { BillingSubscriptionSnapshot } from "./billing";
import {
  createSSEStream,
  getStreamingHeaders,
  getCorsHeaders,
  type SSEStreamController,
} from "./lib/streaming";
import { validateAuth, type AuthResult } from "./lib/httpAuth";
import { authComponent, createAuth } from "./betterAuth";
import { countPoints, isQdrantConfigured, type QdrantFilter } from "./lib/qdrant";
import { verifyRevenueCatWebhook } from "./lib/webhookSecurity";

const http = httpRouter();

// ============================================================
// CORS Preflight Handler
// ============================================================

http.route({
  path: "/ai/saga",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/detect",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/billing-subscription",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

// ============================================================
// Health Check
// ============================================================

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ============================================================
// Better Auth Routes
// ============================================================

// Register all Better Auth HTTP routes
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [
      "https://cascada.vision",
      "https://convex.cascada.vision",
      "mythos://",
      "tauri://localhost",
      "http://localhost:3000",
      "http://localhost:1420",
      "http://localhost:8081",
      "http://localhost:8082",
      "http://localhost:8083",
      "http://localhost:19006",
    ],
  },
});

// ============================================================
// RevenueCat Webhook
// ============================================================

http.route({
  path: "/webhooks/revenuecat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify webhook authenticity
      const authHeader = request.headers.get("Authorization");
      const isValid = await verifyRevenueCatWebhook(authHeader);

      if (!isValid) {
        console.error("[webhook/revenuecat] Invalid authorization");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await request.json();
      const event = body.event;

      if (!event || !event.type) {
        return new Response(JSON.stringify({ error: "Invalid event payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Log for debugging (remove in production)
      console.log(`[webhook/revenuecat] Received event: ${event.type}`, {
        appUserId: event.app_user_id,
        productId: event.product_id,
        store: event.store,
        environment: event.environment,
      });

      // Process the webhook event
      const result = await ctx.runMutation(internal.subscriptions.processWebhookEvent, {
        event,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[webhook/revenuecat] Error:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Webhook processing failed" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// RevenueCat webhook CORS preflight
http.route({
  path: "/webhooks/revenuecat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

// ============================================================
// Main Saga Agent (SSE Streaming)
// ============================================================

http.route({
  path: "/ai/saga",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");

    // Validate auth
    const auth = await validateAuth(ctx, request);
    if (!auth.isValid) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const {
        kind = "chat",
        projectId,
        prompt,
        threadId,
        messages,
        mentions,
        mode,
        editorContext,
        contextHints,
      } = body as {
        kind?: "chat" | "execute_tool" | "tool-result" | "tool-approval";
        projectId: string;
        prompt?: string;
        threadId?: string;
        messages?: Array<{ role: string; content: string }>;
        mentions?: Array<{ type: string; id: string; name: string }>;
        mode?: string;
        editorContext?: Record<string, unknown>;
        contextHints?: Record<string, unknown>;
      };

      if (!projectId) {
        return new Response(JSON.stringify({ error: "projectId is required" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      if (!auth.userId) {
        return new Response(JSON.stringify({ error: "Authenticated user required" }), {
          status: 401,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const isTemplateBuilder = projectId === "template-builder";
      const projectIdValue = projectId as Id<"projects">;

      if (!isTemplateBuilder) {
        await ctx.runQuery(internal.projects.assertOwner, {
          projectId: projectIdValue,
          userId: auth.userId,
        });
      }

      if (threadId && !isTemplateBuilder) {
        await ctx.runQuery((internal as any)["ai/threads"].assertThreadAccess, {
          threadId,
          projectId: projectIdValue,
          userId: auth.userId,
        });
      }

      // Route by kind
      if (kind === "execute_tool") {
        const { toolName, input } = body as { toolName: string; input: unknown };
        return handleToolExecution(ctx, { toolName, input, projectId, auth, origin });
      }

      if (kind === "tool-result") {
        const { promptMessageId, toolCallId, toolName, result, editorContext: resultEditorContext } = body as {
          promptMessageId: string;
          toolCallId: string;
          toolName: string;
          result: unknown;
          editorContext?: Record<string, unknown>;
        };
        return handleToolResult(ctx, {
          projectId,
          threadId,
          promptMessageId,
          toolCallId,
          toolName,
          result,
          editorContext: resultEditorContext,
          auth,
          origin,
        });
      }

      if (kind === "tool-approval") {
        return new Response(
          JSON.stringify({ error: "tool-approval is deprecated; use tool-result" }),
          {
            status: 400,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          }
        );
      }

      // Default: Chat with SSE streaming
      const resolvedPrompt =
        typeof prompt === "string"
          ? prompt
          : [...(messages ?? [])].reverse().find((m) => m.role === "user")?.content;

      if (!resolvedPrompt) {
        return new Response(JSON.stringify({ error: "prompt is required for chat" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      return handleSagaChat(ctx, {
        projectId,
        prompt: resolvedPrompt,
        threadId,
        mentions,
        mode,
        editorContext,
        contextHints,
        auth,
        origin,
      });
    } catch (error) {
      console.error("[http/ai/saga] Error:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        {
          status: 500,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// ============================================================
// Entity Detection (JSON Response)
// ============================================================

http.route({
  path: "/ai/detect",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");

    const auth = await validateAuth(ctx, request);
    if (!auth.isValid) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { text, projectId, entityTypes, minConfidence } = body as {
        text: string;
        projectId: string;
        entityTypes?: string[];
        minConfidence?: number;
      };

      if (!text || !projectId) {
        return new Response(JSON.stringify({ error: "text and projectId are required" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      if (!auth.userId) {
        return new Response(JSON.stringify({ error: "Authenticated user required" }), {
          status: 401,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      await ctx.runQuery(internal.projects.assertOwner, {
        projectId: projectId as Id<"projects">,
        userId: auth.userId,
      });

      // Call internal action for entity detection
      const result = await ctx.runAction((internal as any)["ai/detect"].detectEntities, {
        text,
        projectId,
        entityTypes,
        minConfidence,
        userId: auth.userId,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[http/ai/detect] Error:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        {
          status: 500,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// ============================================================
// Billing Snapshot (JSON Response)
// ============================================================

http.route({
  path: "/billing-subscription",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("Origin");
    const auth = await validateAuth(ctx, request);

    if (!auth.isValid || !auth.userId) {
      return new Response(
        JSON.stringify({
          error: {
            message: auth.error ?? "Unauthorized",
            code: "UNAUTHORIZED",
          },
        }),
        {
          status: 401,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      const projectId =
        typeof body?.projectId === "string" ? body.projectId : undefined;

      const snapshot = await ctx.runQuery(
        (internal as any).billing.getBillingSubscriptionSnapshot,
        {
          userId: auth.userId,
          projectId,
        }
      );

      const responseBody = projectId
        ? await attachVectorUsage(snapshot, projectId)
        : snapshot;

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[http/billing-subscription] Error:", error);
      return new Response(
        JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : "Billing snapshot failed",
            code: "BILLING_ERROR",
          },
        }),
        {
          status: 500,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// ============================================================
// Handlers
// ============================================================

async function attachVectorUsage(
  snapshot: BillingSubscriptionSnapshot,
  projectId: string
): Promise<BillingSubscriptionSnapshot> {
  const vectorLimit = snapshot.limits?.embeddings.maxVectorsPerProject ?? 0;
  const usageDetail = snapshot.usageDetail ?? {};

  if (!isQdrantConfigured()) {
    return {
      ...snapshot,
      usageDetail: {
        ...usageDetail,
        vectors: {
          used: 0,
          limit: vectorLimit,
          unavailable: true,
        },
      },
    };
  }

  // Requires payload.projectId on Qdrant points for accurate counts.
  const filter: QdrantFilter = {
    must: [{ key: "projectId", match: { value: projectId } }],
  };

  try {
    const used = await countPoints(filter, { exact: false });
    return {
      ...snapshot,
      usageDetail: {
        ...usageDetail,
        vectors: {
          used,
          limit: vectorLimit,
        },
      },
    };
  } catch (error) {
    console.warn("[http/billing-subscription] Qdrant count failed:", error);
    return {
      ...snapshot,
      usageDetail: {
        ...usageDetail,
        vectors: {
          used: 0,
          limit: vectorLimit,
          unavailable: true,
        },
      },
    };
  }
}

interface SagaChatParams {
  projectId: string;
  prompt: string;
  threadId?: string;
  mentions?: Array<{ type: string; id: string; name: string }>;
  mode?: string;
  editorContext?: Record<string, unknown>;
  contextHints?: Record<string, unknown>;
  auth: AuthResult;
  origin: string | null;
}

async function handleSagaChat(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  params: SagaChatParams
): Promise<Response> {
  const { projectId, prompt, threadId, mode, editorContext, contextHints, auth, origin } = params;

  // Create generation stream for persistence
  const streamId = await ctx.runMutation((internal as any)["ai/streams"].create, {
    projectId,
    userId: auth.userId!,
    type: "saga",
  });

  // Create SSE stream
  const stream = createSSEStream(async (sse: SSEStreamController) => {
    try {
      // Run the streaming action
      await ctx.runAction((internal as any)["ai/agentRuntime"].runSagaAgentChatToStream, {
        streamId,
        projectId,
        userId: auth.userId!,
        prompt,
        threadId,
        mode,
        editorContext,
        contextHints,
      });

      // Stream is managed by the action via delta table
      // Here we just poll and forward deltas
      await streamDeltasToSSE(ctx, streamId, sse);
    } catch (error) {
      console.error("[handleSagaChat] Stream error:", error);
      sse.sendError(error instanceof Error ? error.message : "Stream error");
    } finally {
      sse.complete();
    }
  });

  return new Response(stream, {
    headers: getStreamingHeaders(origin),
  });
}

async function streamDeltasToSSE(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  streamId: string,
  sse: SSEStreamController
): Promise<void> {
  let lastIndex = 0;
  let isDone = false;

  while (!isDone) {
    // Poll for new chunks
    const streamState = await ctx.runQuery((internal as any)["ai/streams"].getChunks, {
      streamId,
      afterIndex: lastIndex,
    });

    if (!streamState) {
      sse.sendError("Stream not found");
      return;
    }

    // Send new chunks
    for (const chunk of streamState.chunks) {
      switch (chunk.type) {
        case "delta":
          sse.sendDelta(chunk.content);
          break;
        case "tool":
          sse.sendTool(
            chunk.toolCallId ?? "",
            chunk.toolName ?? "",
            chunk.args,
            chunk.promptMessageId
          );
          break;
        case "tool-approval-request":
          sse.sendToolApprovalRequest(
            chunk.approvalId ?? "",
            chunk.toolName ?? "",
            chunk.args,
            chunk.toolCallId,
            chunk.promptMessageId
          );
          break;
        case "context":
          sse.sendContext(chunk.data);
          break;
        case "error":
          sse.sendError(chunk.content);
          break;
      }
      lastIndex = chunk.index + 1;
    }

    // Check if stream is complete
    if (streamState.status === "done" || streamState.status === "error") {
      isDone = true;
    } else {
      // Small delay before next poll
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

interface ToolExecutionParams {
  toolName: string;
  input: unknown;
  projectId: string;
  auth: AuthResult;
  origin: string | null;
}

async function handleToolExecution(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  params: ToolExecutionParams
): Promise<Response> {
  const { toolName, input, projectId, auth, origin } = params;

  try {
    const result = await ctx.runAction((internal as any)["ai/tools"].execute, {
      toolName,
      input,
      projectId,
      userId: auth.userId!,
    });

    return new Response(JSON.stringify({ toolName, result }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[handleToolExecution] ${toolName} error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Tool execution failed" }),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      }
    );
  }
}

interface ToolResultParams {
  projectId: string;
  threadId?: string;
  promptMessageId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
  editorContext?: Record<string, unknown>;
  auth: AuthResult;
  origin: string | null;
}

async function handleToolResult(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  params: ToolResultParams
): Promise<Response> {
  const { projectId, threadId, promptMessageId, toolCallId, toolName, result, editorContext, auth, origin } = params;

  if (!threadId) {
    return new Response(JSON.stringify({ error: "threadId is required" }), {
      status: 400,
      headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const streamId = await ctx.runMutation((internal as any)["ai/streams"].create, {
    projectId,
    userId: auth.userId!,
    type: "saga-tool-result",
  });

  const stream = createSSEStream(async (sse: SSEStreamController) => {
    try {
      await ctx.runAction((internal as any)["ai/agentRuntime"].applyToolResultAndResumeToStream, {
        streamId,
        projectId,
        userId: auth.userId!,
        threadId,
        promptMessageId,
        toolCallId,
        toolName,
        result,
        editorContext,
      });

      await streamDeltasToSSE(ctx, streamId, sse);
    } catch (error) {
      console.error("[handleToolResult] Error:", error);
      sse.sendError(error instanceof Error ? error.message : "Tool result error");
    } finally {
      sse.complete();
    }
  });

  return new Response(stream, {
    headers: getStreamingHeaders(origin),
  });
}

export default http;
