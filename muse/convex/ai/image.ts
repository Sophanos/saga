/**
 * AI Image Generation Actions
 *
 * Tier-based image generation using OpenRouter models.
 * Migrated from Supabase Edge Function.
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  IMAGE_TIERS,
  selectImageTier,
  type ImageTier,
  checkTaskAccess,
  type TierId,
} from "../lib/providers";
import { assertAiAllowed } from "../lib/quotaEnforcement";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";

interface GenerateImageResult {
  success: boolean;
  assetId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  tier?: ImageTier;
  error?: string;
}

interface OpenRouterImageResponse {
  choices: {
    message: {
      content?: string;
    };
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function buildImagePrompt(prompt: string, negativePrompt?: string): string {
  if (negativePrompt) {
    return `${prompt} --no ${negativePrompt}`;
  }
  return prompt;
}

type ImageCandidate = {
  dataUrl?: string;
  base64?: string;
  url?: string;
};

function resolveAspectRatioSize(aspectRatio?: string): { width?: number; height?: number } {
  if (!aspectRatio) return {};
  const parts = aspectRatio.split(":").map((value) => Number(value));
  if (parts.length !== 2) return {};
  const [w, h] = parts;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return {};

  const maxSide = 1024;
  let width = maxSide;
  let height = Math.round((maxSide * h) / w);

  if (height > maxSide) {
    height = maxSide;
    width = Math.round((maxSide * w) / h);
  }

  const snap = (value: number) => Math.max(64, Math.round(value / 64) * 64);
  return { width: snap(width), height: snap(height) };
}

function resolveImageCandidate(value: string): ImageCandidate | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) {
    return { dataUrl: trimmed };
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { url: trimmed };
  }
  return { base64: trimmed };
}

function extractImageCandidate(payload: unknown): ImageCandidate | null {
  if (typeof payload === "string") {
    return resolveImageCandidate(payload);
  }

  if (Array.isArray(payload)) {
    const first = payload.find((value) => typeof value === "string");
    return typeof first === "string" ? resolveImageCandidate(first) : null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const images = record["images"];
    if (Array.isArray(images) && typeof images[0] === "string") {
      return resolveImageCandidate(images[0]);
    }

    if (typeof record["image"] === "string") {
      return resolveImageCandidate(record["image"]);
    }

    const output = record["output"];
    if (Array.isArray(output) && typeof output[0] === "string") {
      return resolveImageCandidate(output[0]);
    }

    const data = record["data"];
    if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === "object") {
      const first = data[0] as Record<string, unknown>;
      if (typeof first["b64_json"] === "string") {
        return { base64: first["b64_json"] };
      }
      if (typeof first["url"] === "string") {
        return { url: first["url"] };
      }
    }
  }

  return null;
}

function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const parts = dataUrl.split(",");
  if (parts.length !== 2) return null;
  const header = parts[0];
  const base64 = parts[1];
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  return { base64, mimeType };
}

async function resolveImageBuffer(candidate: ImageCandidate): Promise<{ buffer: Buffer; mimeType: string }> {
  if (candidate.dataUrl) {
    const parsed = parseDataUrl(candidate.dataUrl);
    if (!parsed) {
      throw new Error("Invalid data URL returned from image provider");
    }
    return {
      buffer: Buffer.from(parsed.base64, "base64"),
      mimeType: parsed.mimeType,
    };
  }

  if (candidate.base64) {
    return {
      buffer: Buffer.from(candidate.base64, "base64"),
      mimeType: "image/png",
    };
  }

  if (candidate.url) {
    const response = await fetch(candidate.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch generated image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") ?? "image/png";
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  }

  throw new Error("No image data returned from image provider");
}

export const storeGeneratedAsset = internalMutation({
  args: {
    projectId: v.id("projects"),
    entityId: v.optional(v.id("entities")),
    type: v.union(
      v.literal("avatar"),
      v.literal("diagram"),
      v.literal("mockup"),
      v.literal("illustration"),
      v.literal("photo"),
      v.literal("map"),
      v.literal("icon"),
      v.literal("chart"),
      v.literal("reference"),
      v.literal("other")
    ),
    filename: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    sizeBytes: v.number(),
    generationPrompt: v.optional(v.string()),
    generationModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const assetId = await ctx.db.insert("projectAssets", {
      projectId: args.projectId,
      entityId: args.entityId,
      type: args.type,
      filename: args.filename,
      mimeType: args.mimeType,
      storageId: args.storageId,
      thumbnailStorageId: args.thumbnailStorageId,
      width: args.width,
      height: args.height,
      sizeBytes: args.sizeBytes,
      generationPrompt: args.generationPrompt,
      generationModel: args.generationModel,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.ai.imageEmbeddings.embedImageAsset, {
      assetId,
      projectId: args.projectId,
    });

    return assetId;
  },
});

export const generateImageAction = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    prompt: v.string(),
    aspectRatio: v.optional(v.string()),
    negativePrompt: v.optional(v.string()),
    entityId: v.optional(v.string()),
    tier: v.optional(v.string()),
    tierId: v.optional(v.string()),
    byokKey: v.optional(v.string()),
    assetType: v.optional(
      v.union(
        v.literal("avatar"),
        v.literal("diagram"),
        v.literal("mockup"),
        v.literal("illustration"),
        v.literal("photo"),
        v.literal("map"),
        v.literal("icon"),
        v.literal("chart"),
        v.literal("reference"),
        v.literal("other")
      )
    ),
  },
  handler: async (ctx, args): Promise<GenerateImageResult> => {
    const { projectId, userId, negativePrompt, entityId, assetType } = args;
    const userTierId = (args.tierId as TierId) ?? "free";
    const startTime = Date.now();
    const basePrompt = args.prompt.trim();

    // Check tier access
    const access = checkTaskAccess("image_generate", userTierId);
    if (!access.allowed) {
      return { success: false, error: "Image generation not available on current tier" };
    }

    const selectedTier = (args.tier as ImageTier) ?? selectImageTier({ quality: "standard" });
    const tierConfig = IMAGE_TIERS[selectedTier];
    const billingMode = await ctx.runQuery(
      (internal as any).billingSettings.getBillingMode,
      { userId }
    );
    const isByok = billingMode === "byok";
    let generationModel = tierConfig.model;
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    try {
      let imageBuffer: Buffer;
      let mimeType = "image/png";
      const promptForUsage = buildImagePrompt(basePrompt, negativePrompt);

      if (isByok) {
        const byokKey = args.byokKey?.trim();
        if (!byokKey) {
          return { success: false, error: "BYOK key is required for image generation" };
        }

        const byokModel = await ctx.runQuery(
          (internal as any).billingSettings.getPreferredImageModel,
          { userId }
        );
        generationModel = byokModel;

        const response = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${byokKey}`,
            "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
            "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
          },
          body: JSON.stringify({
            model: byokModel,
            messages: [{ role: "user", content: promptForUsage }],
            temperature: 0.7,
            max_tokens: 4096,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, error: `OpenRouter error: ${response.status} - ${errorText}` };
        }

        const data = (await response.json()) as OpenRouterImageResponse;
        const content = data.choices[0]?.message?.content;

        if (!content) {
          return { success: false, error: "No content in response" };
        }

        const markdownMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
        let candidate = markdownMatch ? resolveImageCandidate(markdownMatch[1]) : null;
        if (!candidate && content.trim().startsWith("{")) {
          try {
            candidate = extractImageCandidate(JSON.parse(content));
          } catch {
            candidate = null;
          }
        }
        if (!candidate) {
          candidate = extractImageCandidate(content);
        }
        if (!candidate) {
          return { success: false, error: "No image data in response" };
        }

        const resolvedImage = await resolveImageBuffer(candidate);
        imageBuffer = resolvedImage.buffer;
        mimeType = resolvedImage.mimeType;
        usage = {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        };
      } else {
        const apiKey = process.env["DEEPINFRA_API_KEY"];
        if (!apiKey) {
          return { success: false, error: "DEEPINFRA_API_KEY not configured" };
        }

        await assertAiAllowed(ctx, {
          userId,
          endpoint: "image_generate",
          promptText: promptForUsage,
          requestedMaxOutputTokens: 4096,
        });

        const { width, height } = resolveAspectRatioSize(args.aspectRatio);
        const body: Record<string, unknown> = { prompt: basePrompt };
        if (negativePrompt) {
          body["negative_prompt"] = negativePrompt;
        }
        if (width && height) {
          body["width"] = width;
          body["height"] = height;
        }

        const response = await fetch(`${DEEPINFRA_INFERENCE_URL}/${tierConfig.model}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, error: `DeepInfra error: ${response.status} - ${errorText}` };
        }

        const data = (await response.json()) as unknown;
        const candidate = extractImageCandidate(data);
        if (!candidate) {
          return { success: false, error: "No image data in response" };
        }

        const resolvedImage = await resolveImageBuffer(candidate);
        imageBuffer = resolvedImage.buffer;
        mimeType = resolvedImage.mimeType;
        generationModel = tierConfig.model;
      }

      const arrayBuffer = new ArrayBuffer(imageBuffer.byteLength);
      new Uint8Array(arrayBuffer).set(imageBuffer);
      const blob = new Blob([arrayBuffer], { type: mimeType });

      const storageId = await ctx.storage.store(blob);

      const ext = mimeType.split("/")[1] ?? "png";
      const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

      const assetId = await ctx.runMutation((internal as any)["ai/image"].storeGeneratedAsset, {
        projectId: projectId as Id<"projects">,
        entityId: entityId as Id<"entities"> | undefined,
        type: assetType ?? "other",
        filename,
        mimeType,
        storageId,
        sizeBytes: imageBuffer.length,
        generationPrompt: promptForUsage,
        generationModel,
      });

      const imageUrl = await ctx.storage.getUrl(storageId);

      if (!isByok) {
        await ctx.runMutation(internal.aiUsage.trackUsage, {
          userId,
          projectId,
          endpoint: "image_generate",
          model: generationModel,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          costMicros: Math.round(tierConfig.pricePerImage * 1_000_000),
          billingMode,
          latencyMs: Date.now() - startTime,
          success: true,
        });
      }

      return {
        success: true,
        assetId: assetId as string,
        imageUrl: imageUrl ?? undefined,
        tier: selectedTier,
      };
    } catch (error) {
      console.error("[ai/image] Generation error:", error);

      if (!isByok) {
        await ctx.runMutation(internal.aiUsage.trackUsage, {
          userId,
          projectId,
          endpoint: "image_generate",
          model: generationModel,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          billingMode,
          latencyMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Image generation failed",
      };
    }
  },
});

export const analyzeImageAction = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    imageUrl: v.string(),
    analysisPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, userId, imageUrl, analysisPrompt } = args;
    const startTime = Date.now();

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const defaultPrompt = `Analyze this image and provide:
1. A detailed description
2. Any characters visible (names if determinable, or descriptions)
3. The mood/atmosphere
4. The setting/location
5. The artistic style

Return as JSON: { description, characters, mood, setting, style }`;

    const prompt = analysisPrompt ?? defaultPrompt;

    const { maxOutputTokens } = await assertAiAllowed(ctx, {
      userId,
      endpoint: "image_generate",
      promptText: prompt,
      requestedMaxOutputTokens: 2048,
    });

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
        "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: maxOutputTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterImageResponse;
    const content = data.choices[0]?.message?.content ?? "";

    const billingMode = await ctx.runQuery(
      (internal as any).billingSettings.getBillingMode,
      { userId }
    );
    if (billingMode !== "byok") {
      await ctx.runMutation(internal.aiUsage.trackUsage, {
        userId,
        projectId,
        endpoint: "image-analyze",
        model: "google/gemini-2.0-flash",
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
        billingMode,
        latencyMs: Date.now() - startTime,
        success: true,
      });
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as {
          description: string;
          characters?: string[];
          mood?: string;
          setting?: string;
          style?: string;
        };
      }
    } catch {
      // Fall through to default response
    }

    return {
      description: content,
    };
  },
});
