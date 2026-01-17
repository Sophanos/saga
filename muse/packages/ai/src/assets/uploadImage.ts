/**
 * Upload an image to Convex storage and save asset metadata.
 */

export type UploadImageAssetType =
  | "portrait"
  | "scene"
  | "map"
  | "cover"
  | "reference"
  | "other";

type ProjectAssetType =
  | "avatar"
  | "illustration"
  | "map"
  | "reference"
  | "other";

const ASSET_TYPE_MAP: Record<UploadImageAssetType, ProjectAssetType> = {
  portrait: "avatar",
  scene: "illustration",
  cover: "illustration",
  map: "map",
  reference: "reference",
  other: "other",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConvexClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProjectAssetsApi = any;

export async function uploadProjectImage(opts: {
  convex: ConvexClient;
  projectAssets: ProjectAssetsApi;
  projectId: string;
  entityId?: string;
  file: File | Blob;
  filename: string;
  mimeType: string;
  type: UploadImageAssetType;
  altText?: string;
}): Promise<{ assetId: string; storageId: string; url?: string }> {
  const {
    convex,
    projectAssets,
    projectId,
    entityId,
    file,
    filename,
    mimeType,
    type,
    altText,
  } = opts;

  const uploadUrl: string = await convex.mutation(projectAssets.generateUploadUrl);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: file,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  const uploadResult = (await response.json()) as { storageId?: string };
  const storageId = uploadResult.storageId;
  if (!storageId) {
    throw new Error("Upload did not return a storageId");
  }

  const sizeBytes = "size" in file ? file.size : 0;

  const assetId: string = await convex.mutation(projectAssets.saveAsset, {
    projectId,
    entityId,
    type: ASSET_TYPE_MAP[type],
    filename,
    mimeType,
    storageId,
    sizeBytes,
    altText,
  });

  let url: string | undefined;
  if (projectAssets.getUrl) {
    const result: string | null = await convex.query(projectAssets.getUrl, { storageId });
    url = result ?? undefined;
  }

  return { assetId, storageId, url };
}
