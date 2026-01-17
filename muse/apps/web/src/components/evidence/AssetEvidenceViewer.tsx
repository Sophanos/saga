import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@mythos/ui";
import { rectToXywhPercent, type NormalizedRect } from "@mythos/agent-protocol";
import { api } from "../../../../../convex/_generated/api";
import { EvidenceLinkPicker } from "./EvidenceLinkPicker";
import { AISuggestEvidenceButton } from "./AISuggestEvidenceButton";

export type EvidencePreviewRegion = {
  id?: string;
  shape?: string;
  rect?: { x: number; y: number; w: number; h: number };
  polygon?: Array<{ x: number; y: number }>;
  selector?: string;
  label?: string;
  note?: string;
};

export type EvidencePreviewLink = {
  id?: string;
  regionId?: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  claimPath?: string;
  relation?: string;
  confidence?: number;
  note?: string;
};

export interface AssetEvidenceViewerProps {
  projectId: string;
  assetId: string;
  mode: "edit" | "review";
  imageUrl?: string;
  previewRegions?: Array<Record<string, unknown>>;
  previewLinks?: Array<Record<string, unknown>>;
  className?: string;
  onCreateRegion?: (payload: { rect: NormalizedRect; selector: string }) => void;
}

function normalizePreviewRegion(value: Record<string, unknown>): EvidencePreviewRegion | null {
  const shape = typeof value["shape"] === "string" ? (value["shape"] as string) : undefined;
  const rect = value["rect"] as EvidencePreviewRegion["rect"] | undefined;
  const polygon = value["polygon"] as EvidencePreviewRegion["polygon"] | undefined;
  return {
    id: typeof value["id"] === "string" ? (value["id"] as string) : undefined,
    shape,
    rect,
    polygon,
    selector: typeof value["selector"] === "string" ? (value["selector"] as string) : undefined,
    label: typeof value["label"] === "string" ? (value["label"] as string) : undefined,
    note: typeof value["note"] === "string" ? (value["note"] as string) : undefined,
  };
}

function normalizePreviewLink(value: Record<string, unknown>): EvidencePreviewLink | null {
  return {
    id: typeof value["id"] === "string" ? (value["id"] as string) : undefined,
    regionId: typeof value["regionId"] === "string" ? (value["regionId"] as string) : undefined,
    targetType: typeof value["targetType"] === "string" ? (value["targetType"] as string) : undefined,
    targetId: typeof value["targetId"] === "string" ? (value["targetId"] as string) : undefined,
    targetLabel: typeof value["targetLabel"] === "string" ? (value["targetLabel"] as string) : undefined,
    claimPath: typeof value["claimPath"] === "string" ? (value["claimPath"] as string) : undefined,
    relation: typeof value["relation"] === "string" ? (value["relation"] as string) : undefined,
    confidence: typeof value["confidence"] === "number" ? (value["confidence"] as number) : undefined,
    note: typeof value["note"] === "string" ? (value["note"] as string) : undefined,
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeRect(start: { x: number; y: number }, end: { x: number; y: number }): NormalizedRect {
  const x1 = clamp01(Math.min(start.x, end.x));
  const y1 = clamp01(Math.min(start.y, end.y));
  const x2 = clamp01(Math.max(start.x, end.x));
  const y2 = clamp01(Math.max(start.y, end.y));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

type EvidenceBundle = {
  imageUrl: string | null;
  regions: Array<{
    _id: string;
    shape: string;
    rect?: { x: number; y: number; w: number; h: number };
    polygon?: Array<{ x: number; y: number }>;
    selector: string;
    label?: string;
    note?: string;
  }>;
  links: Array<Record<string, unknown>>;
};

export function AssetEvidenceViewer({
  projectId,
  assetId,
  mode,
  imageUrl,
  previewRegions,
  previewLinks,
  className,
  onCreateRegion,
}: AssetEvidenceViewerProps): JSX.Element {
  const bundle = useQuery(api.evidence.getAssetEvidenceBundle, {
    projectId,
    assetId,
  }) as EvidenceBundle | undefined;
  const createRegion = useMutation(api.evidence.createRegion);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string | undefined>(undefined);

  const storedRegions = bundle?.regions ?? [];
  const storedLinks = bundle?.links ?? [];

  const normalizedPreviewRegions = useMemo(() => {
    return (previewRegions ?? [])
      .map((region) => normalizePreviewRegion(region))
      .filter(Boolean) as EvidencePreviewRegion[];
  }, [previewRegions]);

  const normalizedPreviewLinks = useMemo(() => {
    return (previewLinks ?? [])
      .map((link) => normalizePreviewLink(link))
      .filter(Boolean) as EvidencePreviewLink[];
  }, [previewLinks]);

  const combinedImageUrl = imageUrl ?? bundle?.imageUrl ?? undefined;

  const handlePointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return { x: 0, y: 0 };
      return {
        x: clamp01((event.clientX - bounds.left) / bounds.width),
        y: clamp01((event.clientY - bounds.top) / bounds.height),
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (mode !== "edit") return;
      const point = handlePointer(event);
      setDragStart(point);
      setDragEnd(point);
    },
    [handlePointer, mode]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (mode !== "edit") return;
      if (!dragStart) return;
      setDragEnd(handlePointer(event));
    },
    [dragStart, handlePointer, mode]
  );

  const handlePointerUp = useCallback(async () => {
    if (mode !== "edit" || !dragStart || !dragEnd) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    const rect = normalizeRect(dragStart, dragEnd);
    const isTiny = rect.w < 0.01 || rect.h < 0.01;
    setDragStart(null);
    setDragEnd(null);
    if (isTiny) return;

    const selector = rectToXywhPercent(rect);
    if (onCreateRegion) {
      onCreateRegion({ rect, selector });
      return;
    }

    const result = (await createRegion({
      projectId,
      assetId,
      shape: "rect",
      rect,
      selector,
    })) as { regionId?: string } | null;
    const createdRegionId = result?.regionId;
    if (createdRegionId) setActiveRegionId(createdRegionId);
  }, [assetId, createRegion, dragEnd, dragStart, mode, onCreateRegion, projectId]);

  const draftRect = dragStart && dragEnd ? normalizeRect(dragStart, dragEnd) : null;

  if (!combinedImageUrl) {
    return (
      <div className={cn("text-xs text-mythos-text-muted", className)}>
        Image preview unavailable.
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden rounded-lg border border-mythos-border-default",
          mode === "edit" ? "cursor-crosshair" : "cursor-default"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img src={combinedImageUrl} alt="Evidence" className="block w-full h-auto" />
        <div className="absolute inset-0">
          {storedRegions.map((region) => (
            <div
              key={region._id}
              className="absolute border border-mythos-accent-amber/70 bg-mythos-accent-amber/10"
              style={{
                left: `${(region.rect?.x ?? 0) * 100}%`,
                top: `${(region.rect?.y ?? 0) * 100}%`,
                width: `${(region.rect?.w ?? 0) * 100}%`,
                height: `${(region.rect?.h ?? 0) * 100}%`,
              }}
            />
          ))}
          {storedRegions.some((region) => Array.isArray(region.polygon)) ? (
            <svg
              viewBox="0 0 1 1"
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="none"
            >
              {storedRegions
                .filter((region) => Array.isArray(region.polygon))
                .map((region) => (
                  <polygon
                    key={`stored-poly-${region._id}`}
                    points={(region.polygon ?? [])
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="rgba(245,158,11,0.12)"
                    stroke="rgba(245,158,11,0.8)"
                  />
                ))}
            </svg>
          ) : null}
          {normalizedPreviewRegions.map((region, index) => (
            <div
              key={`preview-${region.id ?? index}`}
              className="absolute border border-dashed border-mythos-accent-cyan/80 bg-mythos-accent-cyan/10"
              style={{
                left: `${(region.rect?.x ?? 0) * 100}%`,
                top: `${(region.rect?.y ?? 0) * 100}%`,
                width: `${(region.rect?.w ?? 0) * 100}%`,
                height: `${(region.rect?.h ?? 0) * 100}%`,
              }}
            />
          ))}
          {draftRect ? (
            <div
              className="absolute border border-dashed border-mythos-accent-green/80 bg-mythos-accent-green/10"
              style={{
                left: `${draftRect.x * 100}%`,
                top: `${draftRect.y * 100}%`,
                width: `${draftRect.w * 100}%`,
                height: `${draftRect.h * 100}%`,
              }}
            />
          ) : null}
          {normalizedPreviewRegions.some((region) => Array.isArray(region.polygon)) ? (
            <svg
              viewBox="0 0 1 1"
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="none"
            >
              {normalizedPreviewRegions
                .filter((region) => Array.isArray(region.polygon))
                .map((region, index) => (
                  <polygon
                    key={`poly-${region.id ?? index}`}
                    points={(region.polygon ?? [])
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="rgba(56,189,248,0.12)"
                    stroke="rgba(56,189,248,0.8)"
                    strokeDasharray="4 3"
                  />
                ))}
            </svg>
          ) : null}
        </div>
      </div>

      {mode === "edit" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-mythos-text-muted">
            <span>Link evidence</span>
            <AISuggestEvidenceButton assetId={assetId} imageUrl={combinedImageUrl} />
          </div>
          <EvidenceLinkPicker
            projectId={projectId}
            assetId={assetId}
            regionId={activeRegionId}
          />
        </div>
      ) : null}

      {(storedLinks.length > 0 || normalizedPreviewLinks.length > 0) && (
        <div className="text-xs text-mythos-text-muted space-y-1">
          {[...storedLinks, ...normalizedPreviewLinks].map((link, index) => {
            const record = link as Record<string, unknown>;
            let key = `link-${index}`;
            if (typeof record["_id"] === "string") {
              key = record["_id"] as string;
            } else if (typeof record["id"] === "string") {
              key = record["id"] as string;
            }

            let label = "Evidence link";
            if (typeof record["targetLabel"] === "string") {
              label = record["targetLabel"] as string;
            } else if (typeof record["targetType"] === "string") {
              label = record["targetType"] as string;
            }

            return <div key={key}>{label}</div>;
          })}
        </div>
      )}
    </div>
  );
}
