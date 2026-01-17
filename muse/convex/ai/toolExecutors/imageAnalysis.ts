import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { embedTextWithClip, isDeepInfraImageEmbeddingConfigured } from "../../lib/providers/deepinfraImageEmbedding";
import { getModelForTaskSync } from "../../lib/providers/taskConfig";
import { searchPoints, isQdrantConfigured, type QdrantFilter } from "../../lib/qdrant";
import type { AnalyzeImageArgs, AnalyzeImageResult } from "../../../packages/agent-protocol/src/tools";
import { SAGA_IMAGES_COLLECTION } from "./constants";

/**
 * Unified analyze_image executor with mode dispatch.
 * Consolidates vision analysis, text→image search, and image→image similarity.
 */
export async function executeAnalyzeImage(
  ctx: ActionCtx,
  input: AnalyzeImageArgs,
  projectId: string,
  userId: string
): Promise<AnalyzeImageResult> {
  // Default to vision mode for backwards compatibility (no mode specified)
  const mode = input.mode ?? "vision";

  switch (mode) {
    case "vision": {
      // Call the vision LLM action
      if (!input.imageSource) {
        throw new Error("imageSource is required for vision mode");
      }
      const visionResult = await ctx.runAction(
        (internal as any)["ai/image"].analyzeImageAction,
        {
          projectId,
          userId,
          imageUrl: input.imageSource,
          analysisPrompt: input.analysisPrompt,
          entityTypeHint: input.entityTypeHint,
          extractionFocus: input.extractionFocus,
        }
      );
      return {
        mode: "vision",
        suggestedEntityType: visionResult.suggestedEntityType,
        suggestedName: visionResult.suggestedName,
        visualDescription: visionResult.visualDescription ?? {},
        description: visionResult.description ?? "",
        confidence: visionResult.confidence ?? 0.8,
        assetId: visionResult.assetId,
        imageUrl: visionResult.imageUrl,
      };
    }

    case "search": {
      // Text → image search via Qdrant
      if (!input.query) {
        throw new Error("query is required for search mode");
      }
      const searchResult = await executeAnalyzeImageSearch(
        {
          query: input.query,
          limit: input.options?.limit,
          assetType: input.options?.assetType,
          entityType: input.options?.entityType,
          style: input.options?.style,
        },
        projectId
      );
      return {
        mode: "search",
        query: input.query,
        results: searchResult.images.map((img) => ({
          assetId: img.id,
          imageUrl: img.url,
          score: img.score,
          entityId: img.entityId,
          assetType: img.assetType as any,
          style: img.style as any,
        })),
      };
    }

    case "similar": {
      // Image → image similarity via Qdrant
      if (!input.assetId && !input.entityName) {
        throw new Error("assetId or entityName is required for similar mode");
      }
      const similarResult = await executeAnalyzeImageSimilar(
        {
          assetId: input.assetId ?? "",
          entityName: input.entityName,
          limit: input.options?.limit,
          assetType: input.options?.assetType,
        },
        projectId
      );
      return {
        mode: "similar",
        referenceAssetId: similarResult.sourceImage?.id ?? input.assetId ?? "",
        results: similarResult.images.map((img) => ({
          assetId: img.id,
          imageUrl: img.url,
          score: img.similarity,
          entityId: img.entityId,
          assetType: img.assetType as any,
        })),
      };
    }

    default:
      throw new Error(`Unknown analyze_image mode: ${mode}`);
  }
}

interface SearchImagesInput {
  query: string;
  projectId?: string;
  limit?: number;
  assetType?: string;
  entityId?: string;
  entityType?: string;
  style?: string;
}

interface ImageSearchResult {
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl?: string;
    description?: string;
    entityId?: string;
    entityName?: string;
    assetType?: string;
    style?: string;
    score: number;
  }>;
  total: number;
}

async function executeAnalyzeImageSearch(
  input: SearchImagesInput,
  projectId: string
): Promise<ImageSearchResult> {
  if (!input.query) {
    throw new Error("query is required for image search");
  }

  if (!isDeepInfraImageEmbeddingConfigured()) {
    throw new Error("CLIP embedding service not configured (DEEPINFRA_API_KEY required)");
  }

  if (!isQdrantConfigured()) {
    throw new Error("Vector search not configured");
  }

  const limit = Math.min(input.limit ?? 10, 50);

  // Generate CLIP text embedding for cross-modal image search
  // Uses the same model as image embeddings so vectors are in the same space
  const clipModel = getModelForTaskSync("image_embed", "free");
  const queryEmbedding = await embedTextWithClip({
    model: clipModel.model,
    text: input.query,
  });

  // Build filter
  const filter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: projectId } },
      { key: "type", match: { value: "image" } },
    ],
  };

  if (input.assetType) {
    filter.must!.push({ key: "asset_type", match: { value: input.assetType } });
  }
  if (input.entityId) {
    filter.must!.push({ key: "entity_id", match: { value: input.entityId } });
  }
  if (input.entityType) {
    filter.must!.push({ key: "entity_type", match: { value: input.entityType } });
  }
  if (input.style) {
    filter.must!.push({ key: "style", match: { value: input.style } });
  }

  // Search Qdrant
  const results = await searchPoints(
    queryEmbedding,
    limit,
    filter,
    { collection: SAGA_IMAGES_COLLECTION }
  );

  return {
    images: results.map((r) => ({
      id: r.id,
      url: r.payload["url"] as string,
      thumbnailUrl: r.payload["thumbnail_url"] as string | undefined,
      description: r.payload["description"] as string | undefined,
      entityId: r.payload["entity_id"] as string | undefined,
      entityName: r.payload["entity_name"] as string | undefined,
      assetType: r.payload["asset_type"] as string | undefined,
      style: r.payload["style"] as string | undefined,
      score: r.score,
    })),
    total: results.length,
  };
}

interface FindSimilarImagesInput {
  assetId: string;
  entityName?: string;
  projectId?: string;
  limit?: number;
  assetType?: string;
}

interface SimilarImagesResult {
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl?: string;
    description?: string;
    entityId?: string;
    entityName?: string;
    assetType?: string;
    similarity: number;
  }>;
  sourceImage?: {
    id: string;
    url: string;
    description?: string;
  };
}

async function executeAnalyzeImageSimilar(
  input: FindSimilarImagesInput,
  projectId: string
): Promise<SimilarImagesResult> {
  if (!input.assetId && !input.entityName) {
    throw new Error("assetId or entityName is required for similar image search");
  }
  // TODO: If entityName is provided without assetId, look up entity portrait
  if (!input.assetId) {
    throw new Error("entityName lookup not yet implemented - please provide assetId directly");
  }

  if (!isQdrantConfigured()) {
    throw new Error("Vector search not configured");
  }

  const limit = Math.min(input.limit ?? 10, 50);

  // First, get the source image's vector from Qdrant
  const sourceFilter: QdrantFilter = {
    must: [{ has_id: [input.assetId] }],
  };

  const sourceResults = await searchPoints(
    [],
    1,
    sourceFilter,
    { collection: SAGA_IMAGES_COLLECTION }
  );

  if (sourceResults.length === 0) {
    throw new Error(`Source image ${input.assetId} not found`);
  }

  const sourceImage = sourceResults[0];
  const sourceVector = sourceImage.vector;

  if (!sourceVector) {
    throw new Error(`Source image ${input.assetId} has no vector`);
  }

  // Build filter for similar images
  const filter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: projectId } },
      { key: "type", match: { value: "image" } },
    ],
    must_not: [{ has_id: [input.assetId] }],
  };

  if (input.assetType) {
    filter.must!.push({ key: "asset_type", match: { value: input.assetType } });
  }

  const results = await searchPoints(
    sourceVector,
    limit,
    filter,
    { collection: SAGA_IMAGES_COLLECTION }
  );

  return {
    images: results.map((r) => ({
      id: r.id,
      url: r.payload["url"] as string,
      thumbnailUrl: r.payload["thumbnail_url"] as string | undefined,
      description: r.payload["description"] as string | undefined,
      entityId: r.payload["entity_id"] as string | undefined,
      entityName: r.payload["entity_name"] as string | undefined,
      assetType: r.payload["asset_type"] as string | undefined,
      similarity: r.score,
    })),
    sourceImage: {
      id: sourceImage.id,
      url: sourceImage.payload["url"] as string,
      description: sourceImage.payload["description"] as string | undefined,
    },
  };
}
