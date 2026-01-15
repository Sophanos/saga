/**
 * Batch Render Utility - Render multiple artifacts to SVG/PNG for PDF export
 *
 * Uses an offscreen container to render each artifact and export to image format.
 * This enables proper visual rendering in batch PDF exports.
 */

import { createRoot, type Root } from "react-dom/client";
import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import type { Artifact } from "@mythos/state";
import { parseArtifactEnvelope, type ArtifactEnvelopeByType } from "@mythos/core";
import { toPng, toSvg } from "html-to-image";
import type { ArtifactPdfPage } from "./pdf";

export type BatchRenderFormat = "svg" | "png";

export interface BatchRenderResult {
  artifact: Artifact;
  format: BatchRenderFormat;
  dataUrl?: string;
  error?: string;
}

interface OffscreenRendererHandle {
  export: (format: BatchRenderFormat) => Promise<string | null>;
}

interface OffscreenRendererProps {
  envelope: ArtifactEnvelopeByType;
  onReady: () => void;
}

/**
 * Simplified offscreen renderer for batch export.
 * Renders artifact content to a container that can be captured as image.
 */
const OffscreenRenderer = forwardRef<OffscreenRendererHandle, OffscreenRendererProps>(
  ({ envelope, onReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      // Signal ready after a brief delay to allow rendering
      const timer = setTimeout(onReady, 100);
      return () => clearTimeout(timer);
    }, [onReady]);

    useImperativeHandle(ref, () => ({
      export: async (format: BatchRenderFormat): Promise<string | null> => {
        if (!containerRef.current) return null;
        try {
          const fn = format === "svg" ? toSvg : toPng;
          return await fn(containerRef.current, { cacheBust: true });
        } catch {
          return null;
        }
      },
    }));

    // Render based on envelope type
    const renderContent = () => {
      switch (envelope.type) {
        case "table":
          return renderTable(envelope);
        case "diagram":
          return renderDiagram(envelope);
        case "timeline":
          return renderTimeline(envelope);
        case "prose":
        case "dialogue":
        case "lore":
        case "code":
        case "map":
          return renderProse(envelope);
        case "outline":
          return renderOutline(envelope);
        case "entityCard":
          return renderEntityCard(envelope);
        case "chart":
          return renderChartPlaceholder(envelope);
        default:
          return <div>Unsupported artifact type</div>;
      }
    };

    return (
      <div
        ref={containerRef}
        style={{
          padding: "16px",
          backgroundColor: "#1a1a2e",
          color: "#e0e0e0",
          fontFamily: "system-ui, sans-serif",
          minWidth: "500px",
          maxWidth: "800px",
        }}
      >
        {renderContent()}
      </div>
    );
  }
);

OffscreenRenderer.displayName = "OffscreenRenderer";

// Helper to format cell values
function formatCellValue(cell: { t: string; v: unknown } | undefined): string {
  if (!cell) return "";
  return String(cell.v ?? "");
}

// Simple static renderers for each artifact type
function renderTable(envelope: Extract<ArtifactEnvelopeByType, { type: "table" }>) {
  const { columnsById, columnOrder, rowsById, rowOrder } = envelope.data;
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          {columnOrder.map((colId) => (
            <th
              key={colId}
              style={{
                border: "1px solid #444",
                padding: "8px",
                backgroundColor: "#252540",
                textAlign: "left",
              }}
            >
              {columnsById[colId]?.label ?? colId}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowOrder.map((rowId) => {
          const row = rowsById[rowId];
          if (!row) return null;
          return (
            <tr key={rowId}>
              {columnOrder.map((colId) => (
                <td
                  key={colId}
                  style={{ border: "1px solid #333", padding: "8px" }}
                >
                  {formatCellValue(row.cells[colId])}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function renderDiagram(envelope: Extract<ArtifactEnvelopeByType, { type: "diagram" }>) {
  const { nodesById, nodeOrder, edgesById, edgeOrder } = envelope.data;
  return (
    <div>
      <div style={{ marginBottom: "12px", fontWeight: "bold" }}>
        {envelope.title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        {nodeOrder.map((nodeId) => {
          const node = nodesById[nodeId];
          if (!node) return null;
          return (
            <div
              key={nodeId}
              style={{
                padding: "8px 12px",
                backgroundColor: "#3a3a5a",
                borderRadius: "6px",
                border: "1px solid #555",
              }}
            >
              {node.data.title}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: "12px", color: "#888" }}>
        {edgeOrder.length} relationship{edgeOrder.length !== 1 ? "s" : ""}
        {edgeOrder.map((edgeId) => {
          const edge = edgesById[edgeId];
          if (!edge) return null;
          const source = nodesById[edge.source]?.data?.title ?? edge.source;
          const target = nodesById[edge.target]?.data?.title ?? edge.target;
          return (
            <div key={edgeId} style={{ marginTop: "4px" }}>
              {source} → {target}
              {edge.data?.label ? ` (${edge.data.label})` : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderTimeline(envelope: Extract<ArtifactEnvelopeByType, { type: "timeline" }>) {
  const { itemsById, itemOrder } = envelope.data;
  return (
    <div>
      <div style={{ marginBottom: "12px", fontWeight: "bold" }}>
        {envelope.title}
      </div>
      {itemOrder.map((itemId) => {
        const item = itemsById[itemId];
        if (!item) return null;
        return (
          <div
            key={itemId}
            style={{
              display: "flex",
              gap: "12px",
              padding: "8px 0",
              borderBottom: "1px solid #333",
            }}
          >
            <div style={{ minWidth: "80px", color: "#888" }}>
              {item.start}
            </div>
            <div>{item.content}</div>
          </div>
        );
      })}
    </div>
  );
}

function renderProse(
  envelope: Extract<
    ArtifactEnvelopeByType,
    { type: "prose" | "dialogue" | "lore" | "code" | "map" }
  >
) {
  const { blocksById, blockOrder } = envelope.data;
  return (
    <div>
      <div style={{ marginBottom: "12px", fontWeight: "bold" }}>
        {envelope.title}
      </div>
      {blockOrder.map((blockId) => {
        const block = blocksById[blockId];
        if (!block) return null;
        return (
          <p key={block.blockId} style={{ marginBottom: "8px", lineHeight: "1.6" }}>
            {block.markdown}
          </p>
        );
      })}
    </div>
  );
}

function renderOutline(envelope: Extract<ArtifactEnvelopeByType, { type: "outline" }>) {
  const { itemsById, childrenByParentId } = envelope.data;

  // Get root items (items without a parent or with parentId = "root")
  const rootItemIds = childrenByParentId["root"] ?? [];

  const renderItems = (itemIds: string[], depth = 0): JSX.Element[] => {
    return itemIds.map((itemId) => {
      const item = itemsById[itemId];
      if (!item) return null;
      const children = childrenByParentId[itemId] ?? [];
      return (
        <div key={itemId} style={{ marginLeft: depth * 16 }}>
          <div style={{ padding: "4px 0" }}>
            • {item.title}
          </div>
          {children.length > 0 && (
            <div>{renderItems(children, depth + 1)}</div>
          )}
        </div>
      );
    }).filter(Boolean) as JSX.Element[];
  };

  return (
    <div>
      <div style={{ marginBottom: "12px", fontWeight: "bold" }}>
        {envelope.title}
      </div>
      {renderItems(rootItemIds)}
    </div>
  );
}

function renderEntityCard(envelope: Extract<ArtifactEnvelopeByType, { type: "entityCard" }>) {
  const { entityId, displayFields, imageUrl } = envelope.data;
  return (
    <div>
      <div style={{ marginBottom: "8px" }}>
        <span style={{ fontWeight: "bold", fontSize: "16px" }}>
          {envelope.title}
        </span>
        <span style={{ marginLeft: "8px", color: "#888", fontSize: "12px" }}>
          {entityId}
        </span>
      </div>
      {imageUrl && (
        <div style={{ marginBottom: "12px" }}>
          <img src={imageUrl} alt="" style={{ maxWidth: "200px", borderRadius: "4px" }} />
        </div>
      )}
      {displayFields && Object.keys(displayFields).length > 0 && (
        <div style={{ fontSize: "14px" }}>
          {Object.entries(displayFields).map(([key, value]) => (
            <div key={key} style={{ padding: "4px 0" }}>
              <span style={{ color: "#888" }}>{key}:</span> {String(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderChartPlaceholder(envelope: Extract<ArtifactEnvelopeByType, { type: "chart" }>) {
  return (
    <div style={{ textAlign: "center", padding: "24px" }}>
      <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
        {envelope.title}
      </div>
      <div style={{ color: "#888" }}>Chart: {envelope.data.chartKind}</div>
    </div>
  );
}

/**
 * Render a single artifact to SVG/PNG in an offscreen container
 */
async function renderArtifactOffscreen(
  artifact: Artifact,
  format: BatchRenderFormat
): Promise<BatchRenderResult> {
  // Parse envelope
  if (artifact.format !== "json") {
    return {
      artifact,
      format,
      error: "Only JSON format artifacts can be rendered",
    };
  }

  let envelope: ArtifactEnvelopeByType;
  try {
    envelope = parseArtifactEnvelope(JSON.parse(artifact.content));
  } catch (err) {
    return {
      artifact,
      format,
      error: `Failed to parse artifact: ${err}`,
    };
  }

  // Create offscreen container
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  document.body.appendChild(container);

  let root: Root | null = null;

  try {
    // Create React root and render
    root = createRoot(container);
    const rendererRef = { current: null as OffscreenRendererHandle | null };

    await new Promise<void>((resolve) => {
      // Use a simpler approach - direct render with callback
      root!.render(
        <OffscreenRenderer
          ref={(handle) => {
            rendererRef.current = handle;
          }}
          envelope={envelope}
          onReady={resolve}
        />
      );
    });

    // Wait a bit more for complex renderers
    await new Promise((r) => setTimeout(r, 150));

    // Export
    const dataUrl = await rendererRef.current?.export(format);
    if (!dataUrl) {
      return { artifact, format, error: "Export failed" };
    }

    return { artifact, format, dataUrl };
  } catch (err) {
    return { artifact, format, error: String(err) };
  } finally {
    // Cleanup
    if (root) {
      root.unmount();
    }
    document.body.removeChild(container);
  }
}

/**
 * Batch render multiple artifacts to PDF pages
 */
export async function batchRenderArtifacts(
  artifacts: Artifact[],
  format: BatchRenderFormat = "png"
): Promise<ArtifactPdfPage[]> {
  const pages: ArtifactPdfPage[] = [];

  for (const artifact of artifacts) {
    const result = await renderArtifactOffscreen(artifact, format);
    const subtitle = `${artifact.type} · ${artifact.format} · key:${artifact.id}`;

    if (result.error || !result.dataUrl) {
      // Fallback to text content
      pages.push({
        title: artifact.title || artifact.id,
        subtitle,
        text: artifact.content,
      });
    } else if (format === "svg") {
      // Decode SVG from data URL
      const svgContent = decodeSvgFromDataUrl(result.dataUrl);
      if (svgContent) {
        pages.push({
          title: artifact.title || artifact.id,
          subtitle,
          svg: svgContent,
        });
      } else {
        pages.push({
          title: artifact.title || artifact.id,
          subtitle,
          imageDataUrl: result.dataUrl,
        });
      }
    } else {
      // PNG
      pages.push({
        title: artifact.title || artifact.id,
        subtitle,
        imageDataUrl: result.dataUrl,
      });
    }
  }

  return pages;
}

function decodeSvgFromDataUrl(dataUrl: string): string | null {
  if (!dataUrl.startsWith("data:image/svg+xml")) return null;
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return null;
  const payload = dataUrl.slice(commaIndex + 1);
  const isBase64 = dataUrl.slice(0, commaIndex).includes(";base64");
  try {
    if (isBase64) {
      return atob(payload);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}
