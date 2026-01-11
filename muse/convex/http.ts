/**
 * Convex HTTP Router
 *
 * Exposes HTTP endpoints for AI streaming and webhooks.
 * Endpoints are accessible at https://convex.cascada.vision/*
 *
 * Routes:
 * - POST /ai/saga - Main Saga agent (SSE streaming)
 * - POST /ai/chat - Simple chat (SSE streaming or JSON)
 * - POST /ai/detect - Entity detection (JSON response)
 * - POST /ai/lint - Consistency linting (JSON response)
 * - POST /ai/dynamics - Interaction extraction (JSON response)
 * - POST /ai/genesis - World seed generation (JSON response)
 * - POST /ai/image - Image generation (JSON response)
 * - POST /ai/image-analyze - Image analysis (JSON response)
 * - POST /ai/search - Semantic search (JSON response)
 * - POST /ai/embed - Embedding generation and Qdrant upsert/delete (JSON response)
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
import { retrieveRAGContext } from "./ai/rag";
import { generateEmbeddings, isDeepInfraConfigured } from "./lib/embeddings";
import { canonicalizeName } from "./lib/canonicalize";
import {
  countPoints,
  deletePoints,
  deletePointsByFilter,
  isQdrantConfigured,
  upsertPoints,
  type QdrantFilter,
} from "./lib/qdrant";
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
  path: "/ai/lint",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/dynamics",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/genesis",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/image",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/image-analyze",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/search",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get("Origin")),
    });
  }),
});

http.route({
  path: "/ai/embed",
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
// Simple Chat (SSE or JSON)
// ============================================================

http.route({
  path: "/ai/chat",
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
      const { messages, projectId, mentions, stream } = body as {
        messages?: Array<{ role: string; content: string }>;
        projectId?: string;
        mentions?: Array<{ type: string; id: string; name: string }>;
        stream?: boolean;
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

      await ctx.runQuery(internal.projects.assertOwner, {
        projectId: projectId as Id<"projects">,
        userId: auth.userId,
      });

      const prompt = [...(messages ?? [])].reverse().find((m) => m.role === "user")?.content;
      if (!prompt) {
        return new Response(JSON.stringify({ error: "messages with a user prompt are required" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      if (stream !== false) {
        return handleSagaChat(ctx, {
          projectId,
          prompt,
          mentions,
          auth,
          origin,
        });
      }

      const result = await runSagaChatToJson(ctx, {
        projectId,
        prompt,
        mentions,
        auth,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[http/ai/chat] Error:", error);
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
      const { text, projectId, existingEntities, options } = body as {
        text?: string;
        projectId?: string;
        existingEntities?: Array<{
          id: string;
          name: string;
          aliases: string[];
          type: string;
        }>;
        options?: {
          minConfidence?: number;
          entityTypes?: string[];
          detectAliases?: boolean;
          matchExisting?: boolean;
          maxEntities?: number;
          includeContext?: boolean;
          contextLength?: number;
        };
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

      const detectionStart = Date.now();
      const result = await ctx.runAction((internal as any)["ai/detect"].detectEntities, {
        text,
        projectId,
        entityTypes: options?.entityTypes,
        minConfidence: options?.minConfidence,
        userId: auth.userId,
      });

      const includeContext = options?.includeContext !== false;
      const contextLength = options?.contextLength ?? 50;
      const allowAliases = options?.detectAliases !== false;
      const allowMatching = options?.matchExisting !== false;

      const normalizedExisting = (existingEntities ?? []).map((entity) => ({
        id: entity.id,
        name: entity.name,
        aliases: entity.aliases ?? [],
      }));

      const findExistingMatch = (name: string): string | undefined => {
        const canonical = canonicalizeName(name);
        for (const entity of normalizedExisting) {
          if (canonicalizeName(entity.name) === canonical) return entity.id;
          if (entity.aliases.some((alias) => canonicalizeName(alias) === canonical)) {
            return entity.id;
          }
        }
        return undefined;
      };

      const detectedEntities = (result.entities ?? [])
        .map((entity: any, index: number) => {
          const textSpan = entity.textSpan as { start: number; end: number; text: string } | undefined;
          const occurrence = textSpan
            ? {
                startOffset: textSpan.start,
                endOffset: textSpan.end,
                matchedText: textSpan.text,
                context: includeContext
                  ? text.slice(
                      Math.max(0, textSpan.start - contextLength),
                      Math.min(text.length, textSpan.end + contextLength)
                    )
                  : textSpan.text,
              }
            : null;

          const matchedExistingId = allowMatching ? findExistingMatch(entity.name) : undefined;

          return {
            tempId: `temp_${index}`,
            name: entity.name,
            canonicalName: canonicalizeName(entity.name),
            type: entity.type,
            confidence: entity.confidence,
            occurrences: occurrence ? [occurrence] : [],
            suggestedAliases: allowAliases ? (entity.aliases ?? []) : [],
            inferredProperties: entity.properties ?? {},
            matchedExistingId,
          };
        })
        .slice(0, options?.maxEntities ?? result.entities.length);

      const matchedToExisting = detectedEntities.filter((entity) => entity.matchedExistingId).length;
      const byType = result.stats?.byType ?? {};
      const stats = {
        charactersAnalyzed: text.length,
        totalEntities: detectedEntities.length,
        byType,
        matchedToExisting,
        newEntities: detectedEntities.length - matchedToExisting,
        processingTimeMs: Date.now() - detectionStart,
      };

      return new Response(JSON.stringify({ entities: detectedEntities, warnings: [], stats }), {
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
// Consistency Linter (JSON Response)
// ============================================================

http.route({
  path: "/ai/lint",
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
      const { projectId, documentId, documentContent, rules } = body as {
        projectId?: string;
        documentId?: string;
        documentContent?: string;
        rules?: string[];
      };

      if (!projectId || !documentId || !documentContent) {
        return new Response(JSON.stringify({ error: "projectId, documentId, and documentContent are required" }), {
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

      const result = await ctx.runAction((internal as any)["ai/lint"].runLint, {
        projectId,
        userId: auth.userId,
        documentContent,
        focus: rules,
      });

      return new Response(JSON.stringify({ issues: result.issues ?? [] }), {
        status: 200,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[http/ai/lint] Error:", error);
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
// Dynamics Extraction (JSON Response)
// ============================================================

http.route({
  path: "/ai/dynamics",
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
      const { projectId, content, sceneMarker, documentId, knownEntities } = body as {
        projectId?: string;
        content?: string;
        sceneMarker?: string;
        documentId?: string;
        knownEntities?: Array<{ id: string; name: string; type: string }>;
      };

      if (!projectId || !content) {
        return new Response(JSON.stringify({ error: "projectId and content are required" }), {
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

      const result = await ctx.runAction((internal as any)["ai/dynamics"].extractDynamics, {
        projectId,
        userId: auth.userId,
        content,
        sceneMarker,
        documentId,
        knownEntities,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[http/ai/dynamics] Error:", error);
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
// Genesis (JSON Response)
// ============================================================

http.route({
  path: "/ai/genesis",
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
      const { prompt, genre, preferences } = body as {
        prompt?: string;
        genre?: string;
        preferences?: {
          entityCount?: number;
          includeOutline?: boolean;
          detailLevel?: "minimal" | "standard" | "detailed";
        };
      };

      if (!prompt) {
        return new Response(JSON.stringify({ error: "prompt is required" }), {
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

      const result = await ctx.runAction((internal as any)["ai/genesis"].runGenesis, {
        prompt,
        genre,
        entityCount: preferences?.entityCount,
        detailLevel: preferences?.detailLevel,
        includeOutline: preferences?.includeOutline,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[http/ai/genesis] Error:", error);
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
// Image Generation (JSON Response)
// ============================================================

http.route({
  path: "/ai/image",
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
      const { projectId } = body as { projectId?: string };

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

      await ctx.runQuery(internal.projects.assertOwner, {
        projectId: projectId as Id<"projects">,
        userId: auth.userId,
      });

      const isScene = body?.kind === "scene" || typeof body?.sceneText === "string";

      if (isScene) {
        const { sceneText, style, aspectRatio, sceneFocus, tier, characterReferences } = body as {
          sceneText?: string;
          style?: string;
          aspectRatio?: string;
          sceneFocus?: string;
          tier?: string;
          characterReferences?: Array<{ name: string; entityId: string; portraitUrl?: string }>;
        };

        if (!sceneText) {
          return new Response(JSON.stringify({ error: "sceneText is required for scene generation" }), {
            status: 400,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const result = await ctx.runAction((internal as any)["ai/image"].illustrateSceneAction, {
          projectId,
          userId: auth.userId,
          sceneText,
          style,
          aspectRatio,
          sceneFocus,
          tier,
        });

        if (!result?.success) {
          return new Response(JSON.stringify({ error: result?.error ?? "Scene illustration failed" }), {
            status: 400,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const storagePath = await resolveAssetStoragePath(ctx, result.assetId);
        const sceneDescription = buildSceneDescription(sceneText);
        const charactersIncluded =
          characterReferences?.map((ref) => ({
            name: ref.name,
            entityId: ref.entityId,
            hadPortraitReference: !!ref.portraitUrl,
          })) ?? [];

        return new Response(
          JSON.stringify({
            assetId: result.assetId,
            storagePath,
            imageUrl: result.imageUrl,
            sceneDescription,
            charactersIncluded,
          }),
          {
            status: 200,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          }
        );
      }

      const {
        subject,
        style,
        aspectRatio,
        visualDescription,
        negativePrompt,
        entityId,
        assetType,
        tier,
      } = body as {
        subject?: string;
        style?: string;
        aspectRatio?: string;
        visualDescription?: string;
        negativePrompt?: string;
        entityId?: string;
        assetType?: string;
        tier?: string;
      };

      if (!subject) {
        return new Response(JSON.stringify({ error: "subject is required for image generation" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const result = await ctx.runAction((internal as any)["ai/image"].generateImageAction, {
        projectId,
        userId: auth.userId,
        subject,
        style,
        aspectRatio,
        visualDescription,
        negativePrompt,
        entityId,
        assetType,
        tier,
      });

      if (!result?.success) {
        return new Response(JSON.stringify({ error: result?.error ?? "Image generation failed" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const storagePath = await resolveAssetStoragePath(ctx, result.assetId);

      return new Response(
        JSON.stringify({
          assetId: result.assetId,
          storagePath,
          imageUrl: result.imageUrl,
          entityId,
          cached: false,
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("[http/ai/image] Error:", error);
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
// Image Analysis (JSON Response)
// ============================================================

http.route({
  path: "/ai/image-analyze",
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
      const {
        projectId,
        imageSource,
        entityTypeHint,
        extractionFocus,
        entityId,
        setAsPortrait,
        analysisPrompt,
      } = body as {
        projectId?: string;
        imageSource?: string;
        entityTypeHint?: string;
        extractionFocus?: string;
        entityId?: string;
        setAsPortrait?: boolean;
        analysisPrompt?: string;
      };

      if (!projectId || !imageSource) {
        return new Response(JSON.stringify({ error: "projectId and imageSource are required" }), {
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

      const { imageUrl, assetId } = await resolveImageSource(ctx, {
        projectId,
        imageSource,
        entityId,
        setAsPortrait,
      });

      const analysis = await ctx.runAction((internal as any)["ai/image"].analyzeImageAction, {
        projectId,
        userId: auth.userId,
        imageUrl,
        analysisPrompt,
      });

      const suggestedEntityType =
        entityTypeHint ??
        (Array.isArray((analysis as any)?.characters) && (analysis as any).characters.length > 0
          ? "character"
          : (analysis as any)?.setting
          ? "location"
          : "character");

      const suggestedName = Array.isArray((analysis as any)?.characters)
        ? (analysis as any).characters[0]
        : undefined;

      const visualDescription = {
        artStyle: typeof (analysis as any)?.style === "string" ? (analysis as any).style : undefined,
        mood: typeof (analysis as any)?.mood === "string" ? (analysis as any).mood : undefined,
        atmosphere:
          typeof (analysis as any)?.setting === "string" ? (analysis as any).setting : undefined,
      };

      return new Response(
        JSON.stringify({
          suggestedEntityType,
          suggestedName,
          visualDescription,
          description: (analysis as any)?.description ?? "",
          confidence: 0.7,
          assetId,
          imageUrl,
          extractionFocus,
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("[http/ai/image-analyze] Error:", error);
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
// Semantic Search (JSON Response)
// ============================================================

http.route({
  path: "/ai/search",
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
      const { query, projectId, scope, limit, rerank, rerankTopK } = body as {
        query?: string;
        projectId?: string;
        scope?: "all" | "documents" | "entities";
        limit?: number;
        rerank?: boolean;
        rerankTopK?: number;
      };

      if (!query || !projectId) {
        return new Response(JSON.stringify({ error: "query and projectId are required" }), {
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

      const startTime = Date.now();
      const cappedLimit = Math.min(limit ?? 10, 50);

      const lexicalDocuments = await ctx.runQuery((internal as any)["ai/lexical"].searchDocuments, {
        projectId: projectId as Id<"projects">,
        query,
        limit: cappedLimit,
      });
      const lexicalEntities = await ctx.runQuery((internal as any)["ai/lexical"].searchEntities, {
        projectId: projectId as Id<"projects">,
        query,
        limit: cappedLimit,
      });

      const ragContext = await retrieveRAGContext(query, projectId, {
        scope: scope ?? "all",
        lexical: {
          documents: lexicalDocuments,
          entities: lexicalEntities,
        },
        rerank,
        rerankTopK,
        telemetry: { distinctId: auth.userId },
      });

      const results = [
        ...ragContext.documents.map((doc) => ({
          id: doc.id,
          type: "document" as const,
          title: doc.title ?? "Untitled",
          preview: doc.preview,
          vectorScore: doc.score ?? 0,
          documentId: doc.id,
        })),
        ...ragContext.entities.map((entity) => ({
          id: entity.id,
          type: "entity" as const,
          title: entity.name ?? entity.id,
          preview: entity.preview,
          vectorScore: entity.score ?? 0,
          entityType: entity.type,
          entityId: entity.id,
        })),
      ].slice(0, cappedLimit);

      return new Response(
        JSON.stringify({
          results,
          query,
          processingTimeMs: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("[http/ai/search] Error:", error);
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
// Embeddings (JSON Response)
// ============================================================

http.route({
  path: "/ai/embed",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin");

    const auth = await validateAuth(_ctx, request);
    if (!auth.isValid) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const action = body?.action ?? "embed";

      if (action === "delete") {
        if (!isQdrantConfigured()) {
          return new Response(JSON.stringify({ error: "Vector search not configured" }), {
            status: 500,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const { pointIds, filter } = body as {
          pointIds?: string[];
          filter?: {
            projectId?: string;
            type?: string;
            documentId?: string;
            entityId?: string;
            memoryId?: string;
            assetId?: string;
          };
        };

        if (Array.isArray(pointIds) && pointIds.length > 0) {
          await deletePoints(pointIds);
          return new Response(JSON.stringify({ deleted: pointIds.length }), {
            status: 200,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        if (filter?.projectId && filter?.type) {
          const qdrantFilter: QdrantFilter = {
            must: [
              { key: "project_id", match: { value: filter.projectId } },
              { key: "type", match: { value: filter.type } },
            ],
          };
          if (filter.documentId) {
            qdrantFilter.must!.push({ key: "document_id", match: { value: filter.documentId } });
          }
          if (filter.entityId) {
            qdrantFilter.must!.push({ key: "entity_id", match: { value: filter.entityId } });
          }
          if (filter.memoryId) {
            qdrantFilter.must!.push({ key: "memory_id", match: { value: filter.memoryId } });
          }
          if (filter.assetId) {
            qdrantFilter.must!.push({ key: "asset_id", match: { value: filter.assetId } });
          }

          await deletePointsByFilter(qdrantFilter);
          return new Response(JSON.stringify({ deleted: 0 }), {
            status: 200,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ error: "pointIds or filter are required for delete" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const { inputs, qdrant } = body as {
        inputs?: string[];
        qdrant?: {
          enabled?: boolean;
          collection?: string;
          points?: Array<{ id: string; payload: Record<string, unknown> }>;
        };
      };

      if (!inputs || inputs.length === 0) {
        return new Response(JSON.stringify({ error: "inputs must be non-empty" }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      if (!isDeepInfraConfigured()) {
        return new Response(JSON.stringify({ error: "Embeddings not configured" }), {
          status: 500,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        });
      }

      const startTime = Date.now();
      const embedResult = await generateEmbeddings(inputs, { task: "embed_document" });
      let qdrantUpserted = false;

      if (qdrant?.enabled) {
        if (!isQdrantConfigured()) {
          return new Response(JSON.stringify({ error: "Vector search not configured" }), {
            status: 500,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        if (!qdrant.points || qdrant.points.length !== inputs.length) {
          return new Response(JSON.stringify({ error: "qdrant.points must match inputs length" }), {
            status: 400,
            headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
          });
        }

        const points = embedResult.embeddings.map((vector, index) => ({
          id: qdrant.points![index]!.id,
          vector,
          payload: qdrant.points![index]!.payload,
        }));

        await upsertPoints(points, qdrant.collection ? { collection: qdrant.collection } : undefined);
        qdrantUpserted = true;
      }

      return new Response(
        JSON.stringify({
          embeddings: embedResult.embeddings,
          model: embedResult.model,
          dimensions: embedResult.dimensions,
          qdrantUpserted,
          processingTimeMs: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("[http/ai/embed] Error:", error);
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

function buildSceneDescription(sceneText: string): string {
  const trimmed = sceneText.trim();
  if (trimmed.length <= 200) return trimmed;
  return `${trimmed.slice(0, 200)}...`;
}

async function resolveAssetStoragePath(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  assetId?: string
): Promise<string | null> {
  if (!assetId) return null;
  const asset = await ctx.runQuery((internal as any).projectAssets.get, {
    id: assetId as Id<"projectAssets">,
  });
  return asset?.storageId ?? null;
}

async function resolveImageSource(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  params: {
    projectId: string;
    imageSource: string;
    entityId?: string;
    setAsPortrait?: boolean;
  }
): Promise<{ imageUrl: string; assetId?: string }> {
  const { projectId, imageSource, entityId, setAsPortrait } = params;

  if (!imageSource.startsWith("data:")) {
    return { imageUrl: imageSource };
  }

  const match = imageSource.match(/^data:(.+);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid base64 image source");
  }

  const mimeType = match[1] ?? "image/png";
  const base64Data = match[2] ?? "";
  const buffer = Buffer.from(base64Data, "base64");
  const blob = new Blob([buffer], { type: mimeType });

  const storageId = await ctx.storage.store(blob);
  const imageUrl = await ctx.storage.getUrl(storageId);
  if (!imageUrl) {
    throw new Error("Failed to resolve stored image URL");
  }

  const extension = mimeType.split("/")[1] ?? "png";
  const filename = `analysis_${Date.now()}.${extension}`;
  const assetType = setAsPortrait ? "portrait" : "reference";

  const assetId = await ctx.runMutation((internal as any).projectAssets.saveAssetInternal, {
    projectId: projectId as Id<"projects">,
    entityId: entityId ? (entityId as Id<"entities">) : undefined,
    type: assetType,
    filename,
    mimeType,
    storageId,
    sizeBytes: buffer.byteLength,
  });

  return { imageUrl, assetId };
}

async function runSagaChatToJson(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  params: {
    projectId: string;
    prompt: string;
    mentions?: Array<{ type: string; id: string; name: string }>;
    auth: AuthResult;
  }
): Promise<{ content: string; context: unknown }> {
  const { projectId, prompt, auth } = params;

  const streamId = await ctx.runMutation((internal as any)["ai/streams"].create, {
    projectId,
    userId: auth.userId!,
    type: "chat",
  });

  await ctx.runAction((internal as any)["ai/agentRuntime"].runSagaAgentChatToStream, {
    streamId,
    projectId,
    userId: auth.userId!,
    prompt,
  });

  const streamState = await ctx.runQuery((internal as any)["ai/streams"].getChunks, {
    streamId,
    afterIndex: 0,
  });

  if (!streamState) {
    throw new Error("Stream not found");
  }

  let content = "";
  let context: unknown = { documents: [], entities: [], memories: [] };

  for (const chunk of streamState.chunks) {
    if (chunk.type === "delta") {
      content += chunk.content ?? "";
    } else if (chunk.type === "context" && chunk.data) {
      context = chunk.data;
    } else if (chunk.type === "error") {
      throw new Error(chunk.content ?? "Chat stream error");
    }
  }

  return { content, context };
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
            chunk.approvalType ?? "execution",
            chunk.danger,
            chunk.suggestionId,
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
