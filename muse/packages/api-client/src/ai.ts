/**
 * AI API clients for Mythos
 * Wraps the Supabase Edge Functions
 */

import { z } from "zod";

// ============================================
// SCHEMAS
// ============================================

export const LinterResponseSchema = z.object({
  issues: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["character", "world", "plot", "timeline"]),
      severity: z.enum(["error", "warning", "info"]),
      message: z.string(),
      text: z.string().optional(),
      position: z.object({
        start: z.number(),
        end: z.number(),
      }).optional(),
      suggestion: z.string().optional(),
      fix: z.object({
        oldText: z.string(),
        newText: z.string(),
      }).optional(),
    })
  ),
});

export const CoachResponseSchema = z.object({
  metrics: z.object({
    tension: z.array(z.number()),
    sensory: z.object({
      sight: z.number(),
      sound: z.number(),
      touch: z.number(),
      smell: z.number(),
      taste: z.number(),
    }),
    pacing: z.enum(["accelerating", "steady", "decelerating"]),
    mood: z.string(),
    showDontTellScore: z.number(),
    showDontTellGrade: z.string(),
  }),
  issues: z.array(z.any()),
  insights: z.array(z.string()),
});

export const DetectResponseSchema = z.object({
  entities: z.array(
    z.object({
      text: z.string(),
      type: z.enum([
        "character",
        "location",
        "item",
        "magic_system",
        "faction",
        "event",
        "concept",
      ]),
      confidence: z.number(),
      position: z.object({
        start: z.number(),
        end: z.number(),
      }),
      aliases: z.array(z.string()).optional(),
      existingEntityId: z.string().optional(),
    })
  ),
});

export const DynamicsResponseSchema = z.object({
  interactions: z.array(
    z.object({
      id: z.string(),
      sourceId: z.string(),
      sourceName: z.string(),
      action: z.string(),
      targetId: z.string().optional(),
      targetName: z.string().optional(),
      type: z.enum(["neutral", "hostile", "hidden", "passive"]),
      timeMarker: z.string().optional(),
      effect: z.string().optional(),
    })
  ),
});

// ============================================
// CLIENT
// ============================================

export interface AIClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export class AIClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: AIClientConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async post<T>(
    endpoint: string,
    body: unknown,
    schema: z.ZodType<T>,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey && { "x-api-key": this.apiKey }),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return schema.parse(data);
  }

  /**
   * Lint document for consistency issues
   */
  async lint(
    content: string,
    context?: {
      entities?: Array<{ id: string; name: string; type: string }>;
      projectId?: string;
    },
    signal?: AbortSignal
  ) {
    return this.post(
      "/functions/v1/ai-lint",
      { content, ...context },
      LinterResponseSchema,
      signal
    );
  }

  /**
   * Analyze writing quality
   */
  async coach(
    content: string,
    options?: {
      genre?: string;
      analysisDepth?: "quick" | "full";
    },
    signal?: AbortSignal
  ) {
    return this.post(
      "/functions/v1/ai-coach",
      { content, ...options },
      CoachResponseSchema,
      signal
    );
  }

  /**
   * Detect entities in text
   */
  async detect(
    content: string,
    context?: {
      existingEntities?: Array<{ id: string; name: string; type: string; aliases?: string[] }>;
    },
    signal?: AbortSignal
  ) {
    return this.post(
      "/functions/v1/ai-detect",
      { content, ...context },
      DetectResponseSchema,
      signal
    );
  }

  /**
   * Extract character dynamics/interactions
   */
  async dynamics(
    content: string,
    context?: {
      entities?: Array<{ id: string; name: string; type: string }>;
    },
    signal?: AbortSignal
  ) {
    return this.post(
      "/functions/v1/ai-dynamics",
      { content, ...context },
      DynamicsResponseSchema,
      signal
    );
  }
}
