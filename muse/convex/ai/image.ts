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
  getStylePromptPrefix,
  type ImageTier,
  type ImageStyle,
  getModelForTaskSync,
  checkTaskAccess,
  type TierId,
} from "../lib/providers";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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

function buildImagePrompt(
  subject: string,
  style?: ImageStyle,
  visualDescription?: string,
  negativePrompt?: string
): string {
  const parts: string[] = [];

  if (style) {
    parts.push(getStylePromptPrefix(style));
  }

  parts.push(subject);

  if (visualDescription) {
    parts.push(visualDescription);
  }

  let prompt = parts.join(" ");

  if (negativePrompt) {
    prompt += ` --no ${negativePrompt}`;
  }

  return prompt;
}

function buildScenePrompt(
  sceneText: string,
  style?: ImageStyle,
  sceneFocus?: "action" | "dialogue" | "establishing" | "dramatic"
): string {
  const parts: string[] = [];

  if (style) {
    parts.push(getStylePromptPrefix(style));
  }

  const focusPrompts = {
    action: "dynamic composition, motion blur, intense movement, action pose, dramatic angle",
    dialogue: "conversational framing, eye contact, intimate composition",
    establishing: "wide shot, environmental focus, setting the scene",
    dramatic: "dramatic lighting, emotional intensity, key moment, cinematic composition",
  };

  if (sceneFocus) {
    parts.push(focusPrompts[sceneFocus]);
  }

  parts.push(`Illustrate this scene: ${sceneText.slice(0, 500)}`);

  return parts.join(" ");
}

export const storeGeneratedAsset = internalMutation({
  args: {
    projectId: v.id("projects"),
    entityId: v.optional(v.id("entities")),
    type: v.union(
      v.literal("portrait"),
      v.literal("scene"),
      v.literal("map"),
      v.literal("cover"),
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
    return await ctx.db.insert("projectAssets", {
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
  },
});

export const generateImageAction = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    subject: v.string(),
    style: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
    visualDescription: v.optional(v.string()),
    negativePrompt: v.optional(v.string()),
    entityId: v.optional(v.string()),
    tier: v.optional(v.string()),
    tierId: v.optional(v.string()),
    assetType: v.optional(
      v.union(
        v.literal("portrait"),
        v.literal("scene"),
        v.literal("map"),
        v.literal("cover"),
        v.literal("reference"),
        v.literal("other")
      )
    ),
  },
  handler: async (ctx, args): Promise<GenerateImageResult> => {
    const { projectId, userId, subject, style, visualDescription, negativePrompt, entityId, assetType } = args;
    const userTierId = (args.tierId as TierId) ?? "free";
    const startTime = Date.now();

    // Check tier access
    const access = checkTaskAccess("image", userTierId);
    if (!access.allowed) {
      return { success: false, error: "Image generation not available on current tier" };
    }

    const selectedTier = (args.tier as ImageTier) ?? selectImageTier({ quality: "standard" });
    const tierConfig = IMAGE_TIERS[selectedTier];
    const imageModel = getModelForTaskSync("image", userTierId);

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      return { success: false, error: "OPENROUTER_API_KEY not configured" };
    }

    try {
      const prompt = buildImagePrompt(
        subject,
        style as ImageStyle | undefined,
        visualDescription,
        negativePrompt
      );

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
          "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
        },
        body: JSON.stringify({
          model: imageModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data = (await response.json()) as OpenRouterImageResponse;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        return { success: false, error: "No content in response" };
      }

      const imageMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
      let imageBase64: string | null = null;
      let mimeType = "image/png";

      if (imageMatch) {
        const dataUrl = imageMatch[1];
        const parts = dataUrl.split(",");
        if (parts.length === 2) {
          const header = parts[0];
          imageBase64 = parts[1];
          const mimeMatch = header.match(/data:([^;]+)/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
        }
      }

      if (!imageBase64) {
        return { success: false, error: "No image data in response" };
      }

      const imageBuffer = Buffer.from(imageBase64, "base64");
      const blob = new Blob([imageBuffer], { type: mimeType });

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
        generationPrompt: prompt,
        generationModel: tierConfig.model,
      });

      const imageUrl = await ctx.storage.getUrl(storageId);

      await ctx.runMutation(internal.aiUsage.trackUsage, {
        userId,
        projectId,
        endpoint: "image",
        model: imageModel,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
        costMicros: Math.round(tierConfig.pricePerImage * 1_000_000),
        billingMode: "managed",
        latencyMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        assetId: assetId as string,
        imageUrl: imageUrl ?? undefined,
        tier: selectedTier,
      };
    } catch (error) {
      console.error("[ai/image] Generation error:", error);

      await ctx.runMutation(internal.aiUsage.trackUsage, {
        userId,
        projectId,
        endpoint: "image",
        model: imageModel,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        billingMode: "managed",
        latencyMs: Date.now() - startTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Image generation failed",
      };
    }
  },
});

export const illustrateSceneAction = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    sceneText: v.string(),
    style: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
    sceneFocus: v.optional(
      v.union(
        v.literal("action"),
        v.literal("dialogue"),
        v.literal("establishing"),
        v.literal("dramatic")
      )
    ),
    tier: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateImageResult> => {
    const { projectId, userId, sceneText, style, aspectRatio, sceneFocus, tier } = args;

    const prompt = buildScenePrompt(
      sceneText,
      style as ImageStyle | undefined,
      sceneFocus
    );

    return await ctx.runAction((internal as any)["ai/image"].generateImageAction, {
      projectId,
      userId,
      subject: prompt,
      style,
      aspectRatio,
      tier: tier ?? "standard",
      assetType: "scene",
    });
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterImageResponse;
    const content = data.choices[0]?.message?.content ?? "";

    await ctx.runMutation(internal.aiUsage.trackUsage, {
      userId,
      projectId,
      endpoint: "image-analyze",
      model: "google/gemini-2.0-flash",
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      billingMode: "managed",
      latencyMs: Date.now() - startTime,
      success: true,
    });

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
