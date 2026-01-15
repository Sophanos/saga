/**
 * DeepInfra CLIP embedding helper (image and text embeddings).
 *
 * CLIP embeds both images and text into the same 512-dimensional space,
 * enabling cross-modal search (text → image, image → image).
 */

const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";

export interface EmbedImageWithClipOptions {
  model: string;
  imageUrl: string;
  apiKey?: string;
}

export interface EmbedTextWithClipOptions {
  model: string;
  text: string;
  apiKey?: string;
}

export function isDeepInfraImageEmbeddingConfigured(): boolean {
  return !!process.env["DEEPINFRA_API_KEY"];
}

/**
 * Embed text using CLIP for cross-modal image search.
 * The text embedding will be in the same vector space as CLIP image embeddings.
 */
export async function embedTextWithClip(options: EmbedTextWithClipOptions): Promise<number[]> {
  const apiKey = options.apiKey ?? process.env["DEEPINFRA_API_KEY"];
  if (!apiKey) {
    throw new Error("DEEPINFRA_API_KEY not configured");
  }

  if (!options.text || options.text.trim().length === 0) {
    throw new Error("Text is required for CLIP text embedding");
  }

  const response = await fetch(`${DEEPINFRA_INFERENCE_URL}/${options.model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs: [options.text] }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`DeepInfra CLIP text embedding error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as unknown;
  return parseEmbeddingResponse(data);
}

/**
 * Embed an image using CLIP.
 */
export async function embedImageWithClip(options: EmbedImageWithClipOptions): Promise<number[]> {
  const apiKey = options.apiKey ?? process.env["DEEPINFRA_API_KEY"];
  if (!apiKey) {
    throw new Error("DEEPINFRA_API_KEY not configured");
  }

  const response = await fetch(`${DEEPINFRA_INFERENCE_URL}/${options.model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ inputs: [options.imageUrl] }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`DeepInfra image embedding error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as unknown;
  return parseEmbeddingResponse(data);
}

function parseEmbeddingResponse(payload: unknown): number[] {
  if (isNumberArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload)) {
    const first = payload[0];
    if (isNumberArray(first)) {
      return first;
    }
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (isNumberArray(record["embedding"])) {
      return record["embedding"] as number[];
    }

    const embeddings = record["embeddings"];
    if (Array.isArray(embeddings) && embeddings.length > 0 && isNumberArray(embeddings[0])) {
      return embeddings[0] as number[];
    }

    const data = record["data"];
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0] as Record<string, unknown>;
      if (isNumberArray(first["embedding"])) {
        return first["embedding"] as number[];
      }
    }
  }

  throw new Error("Invalid response: no embeddings returned");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}
