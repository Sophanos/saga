/**
 * Image embeddings for project assets (CLIP via DeepInfra).
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { getModelForTaskSync } from "../lib/providers";
import {
  embedImageWithClip,
  isDeepInfraImageEmbeddingConfigured,
} from "../lib/providers/deepinfraImageEmbedding";
import {
  deletePoints,
  deletePointsByFilter,
  isQdrantConfigured,
  type QdrantConfig,
  type QdrantFilter,
  type QdrantPoint,
  upsertPoints,
} from "../lib/qdrant";

const DEFAULT_IMAGE_VECTOR_NAME = "image";

type ImageEmbeddingResult = {
  embedded: boolean;
  reason?: string;
  pointId?: string;
};

type DeleteEmbeddingResult = {
  deleted: number;
};

type DeleteFilterResult = {
  deleted: boolean;
};

function getImageVectorName(): string {
  return process.env["QDRANT_IMAGE_VECTOR_NAME"] ?? DEFAULT_IMAGE_VECTOR_NAME;
}

function getImageQdrantConfig(): Partial<QdrantConfig> | undefined {
  const collection = process.env["QDRANT_IMAGE_COLLECTION"];
  if (!collection) return undefined;
  return { collection };
}

function buildImagePointId(assetId: Id<"projectAssets">): string {
  return `image:${assetId}`;
}

function shouldEmbedAsset(asset: Doc<"projectAssets">): boolean {
  return asset.mimeType.startsWith("image/");
}

function buildImagePayload(asset: Doc<"projectAssets">): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: "image",
    asset_id: String(asset._id),
    project_id: String(asset.projectId),
    asset_type: asset.type,
    mime_type: asset.mimeType,
    storage_id: String(asset.storageId),
    filename: asset.filename,
    created_at: asset.createdAt,
  };

  if (asset.entityId) {
    payload["entity_id"] = String(asset.entityId);
  }

  if (asset.altText) {
    payload["alt_text"] = asset.altText;
  }

  return payload;
}

function buildImageFilter(params: {
  projectId?: string;
  entityId?: string;
}): QdrantFilter {
  const must = [{ key: "type", match: { value: "image" } }];

  if (params.projectId) {
    must.push({ key: "project_id", match: { value: params.projectId } });
  }

  if (params.entityId) {
    must.push({ key: "entity_id", match: { value: params.entityId } });
  }

  return { must };
}

export const embedImageAsset = internalAction({
  args: {
    assetId: v.id("projectAssets"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args): Promise<ImageEmbeddingResult> => {
    if (!isQdrantConfigured()) {
      return { embedded: false, reason: "qdrant_unconfigured" };
    }

    if (!isDeepInfraImageEmbeddingConfigured()) {
      return { embedded: false, reason: "deepinfra_unconfigured" };
    }

    const asset = await ctx.runQuery(internal.projectAssets.getInternal, {
      id: args.assetId,
    });
    if (!asset) {
      return { embedded: false, reason: "asset_missing" };
    }

    if (asset.projectId !== args.projectId) {
      return { embedded: false, reason: "project_mismatch" };
    }

    if (asset.deletedAt) {
      return { embedded: false, reason: "asset_deleted" };
    }

    if (!shouldEmbedAsset(asset)) {
      return { embedded: false, reason: "unsupported_mime" };
    }

    const imageUrl = await ctx.storage.getUrl(asset.storageId);
    if (!imageUrl) {
      return { embedded: false, reason: "image_unavailable" };
    }

    const resolved = getModelForTaskSync("image_embed", "free");
    if (resolved.provider !== "deepinfra") {
      return { embedded: false, reason: "unsupported_provider" };
    }

    const embedding = await embedImageWithClip({
      model: resolved.model,
      imageUrl,
    });

    const vectorName = getImageVectorName();
    const point: QdrantPoint = {
      id: buildImagePointId(asset._id),
      vector: { [vectorName]: embedding },
      payload: buildImagePayload(asset),
    };

    await upsertPoints([point], getImageQdrantConfig());

    return { embedded: true, pointId: point.id };
  },
});

export const deleteImageEmbeddings = internalAction({
  args: {
    assetIds: v.array(v.id("projectAssets")),
  },
  handler: async (_ctx, args): Promise<DeleteEmbeddingResult> => {
    if (!isQdrantConfigured()) {
      return { deleted: 0 };
    }

    if (args.assetIds.length === 0) {
      return { deleted: 0 };
    }

    const pointIds = args.assetIds.map((assetId) => buildImagePointId(assetId));
    await deletePoints(pointIds, getImageQdrantConfig());

    return { deleted: pointIds.length };
  },
});

export const deleteImageEmbeddingsByProject = internalAction({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (_ctx, args): Promise<DeleteFilterResult> => {
    if (!isQdrantConfigured()) {
      return { deleted: false };
    }

    const filter = buildImageFilter({ projectId: String(args.projectId) });
    await deletePointsByFilter(filter, getImageQdrantConfig());

    return { deleted: true };
  },
});

export const deleteImageEmbeddingsByEntity = internalAction({
  args: {
    entityId: v.id("entities"),
  },
  handler: async (_ctx, args): Promise<DeleteFilterResult> => {
    if (!isQdrantConfigured()) {
      return { deleted: false };
    }

    const filter = buildImageFilter({ entityId: String(args.entityId) });
    await deletePointsByFilter(filter, getImageQdrantConfig());

    return { deleted: true };
  },
});
