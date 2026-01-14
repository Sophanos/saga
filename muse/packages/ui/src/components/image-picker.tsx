/**
 * ImagePicker
 *
 * Notion-style image picker with tabs for Upload, URL embed, and Assets.
 * Used by ChatInput popover and ImageInsertModal.
 */

import * as React from "react";
import { Upload, Link2, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export type ImagePickerTab = "upload" | "url" | "assets" | "unsplash" | "giphy";

export interface ImagePickerAsset {
  id: string;
  storageId: string;
  filename?: string;
  mimeType?: string;
  thumbnailUrl?: string;
}

export interface ImagePickerResult {
  kind: "uploaded" | "url" | "asset";
  url?: string;
  file?: File;
  assetId?: string;
  storageId?: string;
  mimeType?: string;
  altText?: string;
}

// Limits
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

export interface ImagePickerProps {
  /** Available tabs to show */
  tabs?: ImagePickerTab[];
  /** Currently active tab */
  activeTab?: ImagePickerTab;
  /** Callback when tab changes */
  onTabChange?: (tab: ImagePickerTab) => void;
  /** Callback when image is selected */
  onSelect: (result: ImagePickerResult) => void;
  /** Project assets for the assets tab */
  assets?: ImagePickerAsset[];
  /** Loading state for assets */
  assetsLoading?: boolean;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback when validation error occurs */
  onError?: (error: string) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Compact mode for popovers */
  compact?: boolean;
}

export function ImagePicker({
  tabs = ["upload", "url", "assets"],
  activeTab: controlledTab,
  onTabChange,
  onSelect,
  assets = [],
  assetsLoading = false,
  isUploading = false,
  error,
  onError,
  disabled = false,
  className,
  compact = false,
}: ImagePickerProps) {
  const [internalTab, setInternalTab] = React.useState<ImagePickerTab>("upload");
  const [urlInput, setUrlInput] = React.useState("");
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const activeTab = controlledTab ?? internalTab;
  const displayError = error ?? localError;

  const handleTabChange = (tab: ImagePickerTab) => {
    setLocalError(null);
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const handleFileSelect = React.useCallback(
    (files: FileList | File[]) => {
      setLocalError(null);
      const fileArray = Array.from(files);
      const imageFile = fileArray.find((f) => f.type.startsWith("image/"));

      if (!imageFile) {
        const msg = "Please select an image file";
        setLocalError(msg);
        onError?.(msg);
        return;
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
        const msg = "Invalid format. Use PNG, JPG, GIF, or WebP";
        setLocalError(msg);
        onError?.(msg);
        return;
      }

      // Validate file size
      if (imageFile.size > MAX_FILE_SIZE) {
        const msg = `File too large (${(imageFile.size / 1024 / 1024).toFixed(1)}MB). Max 5MB`;
        setLocalError(msg);
        onError?.(msg);
        return;
      }

      onSelect({
        kind: "uploaded",
        file: imageFile,
        mimeType: imageFile.type,
        altText: imageFile.name,
      });
    },
    [onSelect, onError]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled || isUploading) return;
      handleFileSelect(e.dataTransfer.files);
    },
    [disabled, isUploading, handleFileSelect]
  );

  const handleUrlEmbed = React.useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;

    try {
      new URL(url);
    } catch {
      return;
    }

    onSelect({
      kind: "url",
      url,
      altText: url,
    });
    setUrlInput("");
  }, [urlInput, onSelect]);

  const handleAssetSelect = React.useCallback(
    (asset: ImagePickerAsset) => {
      onSelect({
        kind: "asset",
        assetId: asset.id,
        storageId: asset.storageId,
        mimeType: asset.mimeType,
        altText: asset.filename,
      });
    },
    [onSelect]
  );

  const tabConfig = [
    { key: "upload" as const, label: "Upload", icon: Upload },
    { key: "url" as const, label: "Embed link", icon: Link2 },
    { key: "assets" as const, label: "Assets", icon: ImageIcon },
    { key: "unsplash" as const, label: "Unsplash", icon: ImageIcon },
    { key: "giphy" as const, label: "GIPHY", icon: ImageIcon },
  ].filter((t) => tabs.includes(t.key));

  const imageAssets = assets.filter((a) => a.mimeType?.startsWith("image/")).slice(0, 30);

  return (
    <div className={cn("bg-mythos-bg-tertiary rounded-lg overflow-hidden", className)}>
      {/* Tabs */}
      <div className="flex border-b border-mythos-border-subtle">
        {tabConfig.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            disabled={disabled}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 text-xs transition-colors",
              compact ? "py-2" : "py-2.5",
              activeTab === key
                ? "text-mythos-text-primary border-b-2 border-mythos-accent-primary -mb-px"
                : "text-mythos-text-secondary hover:text-mythos-text-primary"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={cn(compact ? "p-3" : "p-4")}>
        {displayError && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs bg-mythos-accent-red/10 text-mythos-accent-red">
            {displayError}
          </div>
        )}

        {activeTab === "upload" && (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg text-center transition-colors",
              compact ? "p-4" : "p-6",
              isDragOver
                ? "border-mythos-accent-primary border-solid bg-mythos-accent-primary/5"
                : "border-mythos-border-subtle"
            )}
            onDragEnter={(e) => {
              e.preventDefault();
              if (!disabled && !isUploading) setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragOver(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled || isUploading}
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-mythos-accent-primary" />
                <p className="text-sm text-mythos-text-secondary">Uploading...</p>
              </div>
            ) : (
              <>
                <ImageIcon className={cn("mx-auto mb-3 text-mythos-text-muted", compact ? "w-8 h-8" : "w-10 h-10")} />
                <p className="text-sm mb-1 text-mythos-text-primary">
                  Drag and drop or{" "}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="underline hover:no-underline text-mythos-accent-primary"
                  >
                    choose file
                  </button>
                </p>
                <p className="text-xs text-mythos-text-muted">Max 5MB, PNG/JPG/GIF/WebP</p>
              </>
            )}
          </div>
        )}

        {activeTab === "url" && (
          <div className="space-y-3">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.png"
              disabled={disabled}
              className={cn(
                "w-full px-3 rounded-lg text-sm focus:outline-none",
                "bg-mythos-bg-secondary text-mythos-text-primary",
                "border border-mythos-border-subtle focus:border-mythos-accent-primary",
                compact ? "py-2" : "py-2.5"
              )}
              onKeyDown={(e) => e.key === "Enter" && handleUrlEmbed()}
            />
            <button
              onClick={handleUrlEmbed}
              disabled={disabled || !urlInput.trim()}
              className={cn(
                "w-full rounded-lg text-sm font-medium transition-colors",
                "bg-mythos-accent-primary text-white disabled:opacity-50",
                compact ? "py-2" : "py-2.5"
              )}
            >
              Embed image
            </button>
          </div>
        )}

        {activeTab === "assets" && (
          <div className={cn("overflow-y-auto", compact ? "max-h-48" : "max-h-60")}>
            {assetsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-mythos-text-muted" />
              </div>
            ) : imageAssets.length === 0 ? (
              <p className="text-xs text-center py-6 text-mythos-text-muted">
                No images in this project
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {imageAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => handleAssetSelect(asset)}
                    disabled={disabled}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-mythos-border-subtle transition-all hover:border-mythos-accent-primary"
                  >
                    {asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.filename ?? "Asset"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-mythos-bg-secondary">
                        <ImageIcon className="w-6 h-6 text-mythos-text-muted" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "unsplash" && (
          <div className="text-center py-6">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-mythos-text-muted" />
            <p className="text-sm text-mythos-text-secondary">Unsplash integration coming soon</p>
          </div>
        )}

        {activeTab === "giphy" && (
          <div className="text-center py-6">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-mythos-text-muted" />
            <p className="text-sm text-mythos-text-secondary">GIPHY integration coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
