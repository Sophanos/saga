/**
 * CLIP Embedding Generation Module
 *
 * Generates CLIP embeddings (512 dimensions) for both text and images
 * using DeepInfra's multilingual CLIP model.
 *
 * ## Model
 * - sentence-transformers/clip-ViT-B-32-multilingual-v1 (512 dims, $0.005/M tokens)
 * - Supports 50+ languages
 * - Works for both text→image and image→image similarity search
 *
 * ## Usage
 * ```typescript
 * import {
 *   generateClipTextEmbedding,
 *   generateClipImageEmbedding,
 *   DEEPINFRA_CLIP_DIMENSIONS,
 * } from "./clip.ts";
 *
 * // Text embedding (for text→image search)
 * const textEmb = await generateClipTextEmbedding("fantasy warrior portrait");
 *
 * // Image embedding (for image→image similarity)
 * const imgEmb = await generateClipImageEmbedding(base64Data, { mimeType: "image/png" });
 * ```
 *
 * @module clip
 */

import { createOpenAI } from "https://esm.sh/@ai-sdk/openai@3.0.0";
import { embed } from "https://esm.sh/ai@6.0.0";
import {
  DEEPINFRA_BASE_URL,
  DeepInfraError,
} from "./deepinfra-types.ts";

// =============================================================================
// Constants
// =============================================================================

/**
 * DeepInfra CLIP model ID (multilingual, 50+ languages)
 */
export const DEEPINFRA_CLIP_MODEL = "sentence-transformers/clip-ViT-B-32-multilingual-v1";

/**
 * CLIP embedding dimensions
 */
export const DEEPINFRA_CLIP_DIMENSIONS = 512;

/**
 * DeepInfra inference endpoint for CLIP
 */
const DEEPINFRA_CLIP_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";

// =============================================================================
// Types
// =============================================================================

export interface ClipEmbeddingResult {
  embedding: number[];
  tokensUsed: number;
  model: string;
}

export interface ClipImageEmbeddingOptions {
  mimeType?: string;
  abortSignal?: AbortSignal;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Get DeepInfra API key from environment
 */
function getDeepInfraApiKey(): string {
  const apiKey = Deno.env.get("DEEPINFRA_API_KEY");
  if (!apiKey) {
    throw new DeepInfraError("DEEPINFRA_API_KEY environment variable not set");
  }
  return apiKey;
}

/**
 * Check if CLIP embedding is available
 */
export function isClipConfigured(): boolean {
  return !!Deno.env.get("DEEPINFRA_API_KEY");
}

// =============================================================================
// Text Embeddings
// =============================================================================

/**
 * Generate CLIP text embedding for text→image search
 *
 * @param text - Text query to embed
 * @param options - Optional abort signal
 * @returns CLIP embedding (512 dimensions)
 *
 * @example
 * ```typescript
 * const result = await generateClipTextEmbedding("dark mysterious warrior");
 * // Use result.embedding for Qdrant search
 * ```
 */
export async function generateClipTextEmbedding(
  text: string,
  options?: { abortSignal?: AbortSignal }
): Promise<ClipEmbeddingResult> {
  const apiKey = getDeepInfraApiKey();

  const provider = createOpenAI({
    apiKey,
    baseURL: DEEPINFRA_BASE_URL,
  });

  try {
    const embeddingModel = provider.textEmbeddingModel(DEEPINFRA_CLIP_MODEL);

    const result = await embed({
      model: embeddingModel,
      value: text,
      abortSignal: options?.abortSignal,
    });

    // Validate dimensions
    if (result.embedding.length !== DEEPINFRA_CLIP_DIMENSIONS) {
      throw new DeepInfraError(
        `CLIP dimension mismatch: expected ${DEEPINFRA_CLIP_DIMENSIONS}, got ${result.embedding.length}`
      );
    }

    return {
      embedding: result.embedding,
      tokensUsed: result.usage?.tokens ?? 0,
      model: DEEPINFRA_CLIP_MODEL,
    };
  } catch (error) {
    if (error instanceof DeepInfraError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DeepInfraError(`Failed to generate CLIP text embedding: ${message}`, undefined, undefined, error);
  }
}

// =============================================================================
// Image Embeddings
// =============================================================================

/**
 * Generate CLIP image embedding for image→image similarity search
 *
 * Uses DeepInfra's inference endpoint which accepts base64 image input.
 *
 * @param imageBase64 - Base64-encoded image data (with or without data URL prefix)
 * @param options - Optional mime type and abort signal
 * @returns CLIP embedding (512 dimensions)
 *
 * @example
 * ```typescript
 * const result = await generateClipImageEmbedding(base64Data, {
 *   mimeType: "image/png"
 * });
 * // Use result.embedding for Qdrant similarity search
 * ```
 */
export async function generateClipImageEmbedding(
  imageBase64: string,
  options?: ClipImageEmbeddingOptions
): Promise<ClipEmbeddingResult> {
  const apiKey = getDeepInfraApiKey();

  // Normalize to data URL format if needed
  let dataUrl = imageBase64;
  if (!imageBase64.startsWith("data:")) {
    const mimeType = options?.mimeType ?? "image/png";
    dataUrl = `data:${mimeType};base64,${imageBase64}`;
  }

  // DeepInfra CLIP inference endpoint expects { inputs: { image: dataUrl } }
  const inferenceUrl = `${DEEPINFRA_CLIP_INFERENCE_URL}/${DEEPINFRA_CLIP_MODEL}`;

  try {
    const response = await fetch(inferenceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {
          image: dataUrl,
        },
      }),
      signal: options?.abortSignal,
    });

    if (!response.ok) {
      let errorMessage = `DeepInfra CLIP error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new DeepInfraError(errorMessage, response.status, "clip_error");
    }

    const data = await response.json();

    // DeepInfra returns { embeddings: [[...]] } for image input
    const embedding = data.embeddings?.[0];
    if (!embedding || !Array.isArray(embedding)) {
      throw new DeepInfraError("Invalid CLIP response: no embedding returned");
    }

    // Validate dimensions
    if (embedding.length !== DEEPINFRA_CLIP_DIMENSIONS) {
      throw new DeepInfraError(
        `CLIP dimension mismatch: expected ${DEEPINFRA_CLIP_DIMENSIONS}, got ${embedding.length}`
      );
    }

    return {
      embedding,
      tokensUsed: data.input_tokens ?? 0,
      model: DEEPINFRA_CLIP_MODEL,
    };
  } catch (error) {
    if (error instanceof DeepInfraError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DeepInfraError(`Failed to generate CLIP image embedding: ${message}`, undefined, undefined, error);
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert embedding array to PostgreSQL vector format string
 *
 * @param embedding - Array of numbers
 * @returns PostgreSQL vector literal string "[1,2,3,...]"
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Parse PostgreSQL vector string to number array
 *
 * @param pgVector - PostgreSQL vector literal string "[1,2,3,...]"
 * @returns Array of numbers
 */
export function fromPgVector(pgVector: string): number[] {
  // Remove brackets and parse
  const cleaned = pgVector.replace(/^\[|\]$/g, "");
  if (!cleaned) return [];
  return cleaned.split(",").map((s) => parseFloat(s.trim()));
}
