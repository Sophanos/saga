import {
  deletePoints,
  deletePointsByFilter,
  upsertPoints,
  type QdrantConfig,
  type QdrantFilter,
  type QdrantPoint,
} from "./qdrant";

export type QdrantCollectionKind = "text" | "image";

export const SAGA_UNIFIED_COLLECTION = "saga_unified";
export const SAGA_VECTORS_COLLECTION_LEGACY = "saga_vectors";
export const SAGA_IMAGES_COLLECTION_LEGACY = "saga_images";

export const QDRANT_TEXT_VECTOR = "text_qwen";
export const QDRANT_IMAGE_VECTOR = "image_clip";
export const QDRANT_SPARSE_VECTOR = "sparse_bm25";

function resolveEnvBool(value: string | undefined): boolean | null {
  if (!value) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function getUnifiedCollectionName(): string {
  return process.env["QDRANT_COLLECTION_UNIFIED"] ?? SAGA_UNIFIED_COLLECTION;
}

export function getLegacyTextCollectionName(): string {
  return process.env["QDRANT_COLLECTION"] ?? SAGA_VECTORS_COLLECTION_LEGACY;
}

export function getLegacyImageCollectionName(): string {
  return process.env["QDRANT_IMAGE_COLLECTION"] ?? SAGA_IMAGES_COLLECTION_LEGACY;
}

export function shouldReadFromUnified(): boolean {
  const forced = resolveEnvBool(process.env["QDRANT_READ_FROM_UNIFIED"]);
  if (forced !== null) return forced;
  return !!process.env["QDRANT_COLLECTION_UNIFIED"];
}

export function shouldDualWrite(): boolean {
  return resolveEnvBool(process.env["QDRANT_DUAL_WRITE"]) ?? false;
}

export function getUnifiedQdrantConfig(): Partial<QdrantConfig> {
  return { collection: getUnifiedCollectionName() };
}

export function getLegacyTextQdrantConfig(): Partial<QdrantConfig> {
  return { collection: getLegacyTextCollectionName() };
}

export function getLegacyImageQdrantConfig(): Partial<QdrantConfig> {
  return { collection: getLegacyImageCollectionName() };
}

export function getReadQdrantConfig(kind: QdrantCollectionKind = "text"): Partial<QdrantConfig> {
  if (shouldReadFromUnified()) return getUnifiedQdrantConfig();
  return kind === "image" ? getLegacyImageQdrantConfig() : getLegacyTextQdrantConfig();
}

export function getWriteQdrantConfigs(
  kind: QdrantCollectionKind = "text"
): Partial<QdrantConfig>[] {
  const primary = getUnifiedQdrantConfig();
  if (!shouldDualWrite()) return [primary];
  const legacy = kind === "image" ? getLegacyImageQdrantConfig() : getLegacyTextQdrantConfig();

  const seen = new Set<string>();
  return [primary, legacy].filter((config) => {
    const collection = config.collection ?? "";
    if (seen.has(collection)) return false;
    seen.add(collection);
    return true;
  });
}

export async function upsertPointsForWrite(
  points: QdrantPoint[],
  kind: QdrantCollectionKind = "text"
): Promise<void> {
  for (const config of getWriteQdrantConfigs(kind)) {
    await upsertPoints(points, config);
  }
}

export async function deletePointsForWrite(
  ids: string[],
  kind: QdrantCollectionKind = "text"
): Promise<void> {
  for (const config of getWriteQdrantConfigs(kind)) {
    await deletePoints(ids, config);
  }
}

export async function deletePointsByFilterForWrite(
  filter: QdrantFilter,
  kind: QdrantCollectionKind = "text"
): Promise<void> {
  for (const config of getWriteQdrantConfigs(kind)) {
    await deletePointsByFilter(filter, config);
  }
}
