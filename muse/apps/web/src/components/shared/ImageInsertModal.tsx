/**
 * ImageInsertModal
 *
 * Notion-style modal for inserting images via upload, URL, or asset picker.
 * Uses the shared ImagePicker component from @mythos/ui.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { ImagePicker, type ImagePickerResult as PickerResult, type ImagePickerAsset } from "@mythos/ui";
import { bg, text, border } from "@mythos/theme";
import { useConvex, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { uploadProjectImage } from "@mythos/ai/assets/uploadImage";
import type { Id } from "../../../../../convex/_generated/dataModel";

export interface ImageInsertResult {
  kind: "uploaded" | "url" | "asset";
  url: string;
  assetId?: string;
  storageId?: string;
  mimeType?: string;
  altText?: string;
}

interface ImageInsertModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (result: ImageInsertResult) => void;
  projectId: string | null;
  position?: { x: number; y: number };
}

export function ImageInsertModal({
  open,
  onClose,
  onInsert,
  projectId,
  position,
}: ImageInsertModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const convex = useConvex();

  const projectAssets = useQuery(
    api.projectAssets.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Convert project assets to ImagePickerAsset format
  const imagePickerAssets: ImagePickerAsset[] = useMemo(() => {
    if (!projectAssets) return [];
    return (projectAssets as Array<{ _id: string; storageId: string; mimeType?: string; filename?: string; thumbnailStorageId?: string }>)
      .filter((a) => a.mimeType?.startsWith("image/"))
      .slice(0, 30)
      .map((asset) => ({
        id: asset._id,
        storageId: asset.storageId,
        filename: asset.filename,
        mimeType: asset.mimeType,
        thumbnailUrl: asset.thumbnailStorageId ? `/api/storage/${asset.thumbnailStorageId}` : undefined,
      }));
  }, [projectAssets]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  const handleSelect = useCallback(
    async (result: PickerResult) => {
      setError(null);

      if (result.kind === "uploaded" && result.file && projectId) {
        setIsUploading(true);
        try {
          const upload = await uploadProjectImage({
            convex,
            projectAssets: api.projectAssets,
            projectId,
            file: result.file,
            filename: result.file.name || `upload-${Date.now()}.png`,
            mimeType: result.file.type || "image/png",
            type: "reference",
            altText: result.file.name || undefined,
          });
          onInsert({
            kind: "uploaded",
            url: upload.url ?? "",
            assetId: upload.assetId,
            storageId: upload.storageId,
            mimeType: result.file.type,
            altText: result.file.name,
          });
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setIsUploading(false);
        }
      } else if (result.kind === "url" && result.url) {
        onInsert({
          kind: "url",
          url: result.url,
          altText: result.url,
        });
        onClose();
      } else if (result.kind === "asset" && result.storageId) {
        try {
          const url = await convex.query(api.projectAssets.getUrl, {
            storageId: result.storageId as Id<"_storage">,
          });
          if (!url) {
            setError("Failed to get asset URL");
            return;
          }
          onInsert({
            kind: "asset",
            url,
            assetId: result.assetId,
            storageId: result.storageId,
            mimeType: result.mimeType,
            altText: result.altText,
          });
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load asset");
        }
      }
    },
    [convex, projectId, onInsert, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-[400px] rounded-xl shadow-2xl overflow-hidden"
        style={{
          background: bg.primary,
          border: `1px solid ${border.default}`,
          ...(position && { position: "absolute", left: position.x, top: position.y }),
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border.subtle }}>
          <h3 className="text-sm font-medium" style={{ color: text.primary }}>
            Add image
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" style={{ color: text.secondary }} />
          </button>
        </div>

        {/* ImagePicker */}
        <ImagePicker
          tabs={["upload", "url", "assets"]}
          onSelect={handleSelect}
          assets={imagePickerAssets}
          isUploading={isUploading}
          error={error}
          disabled={!projectId}
          className="border-none rounded-none"
        />

        {/* Footer hint */}
        {!projectId && (
          <div className="px-4 pb-4">
            <p className="text-xs" style={{ color: text.muted }}>
              Select a project to upload images
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
