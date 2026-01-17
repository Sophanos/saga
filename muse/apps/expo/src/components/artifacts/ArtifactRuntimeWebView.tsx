import { useEffect, useMemo, useRef, useCallback } from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "@/design-system";
import { parseArtifactEnvelope } from "@mythos/core";
import type { Artifact } from "@mythos/state";

interface ArtifactRuntimeWebViewProps {
  artifact: Artifact;
  focusId?: string | null;
  onSelectElement?: (elementId: string) => void;
}

function buildArtifactHtml(
  artifact: Record<string, unknown>,
  theme: { bg: string; text: string; textMuted: string; border: string }
): string {
  const serialized = JSON.stringify(artifact).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: ${theme.bg};
        color: ${theme.text};
      }
      .container {
        padding: 12px;
      }
      .card {
        border: 1px solid ${theme.border};
        background: ${theme.bg};
        border-radius: 10px;
        padding: 12px;
      }
      .muted {
        color: ${theme.textMuted};
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th, td {
        border-bottom: 1px solid ${theme.border};
        padding: 6px 8px;
        text-align: left;
      }
      th {
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 10px;
        color: ${theme.textMuted};
      }
      .row-handle {
        width: 20px;
        color: ${theme.textMuted};
      }
      .focus {
        outline: 2px solid rgba(124, 58, 237, 0.6);
        border-radius: 6px;
      }
      .outline-item {
        margin-bottom: 8px;
      }
      .diagram-node,
      .timeline-item {
        padding: 8px;
        border: 1px solid ${theme.border};
        border-radius: 8px;
        margin-bottom: 8px;
      }
      .diagram-edge {
        font-size: 12px;
        color: ${theme.textMuted};
        margin: 2px 0 10px;
      }
      .chart {
        width: 100%;
        height: 200px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div id="root" class="card"></div>
    </div>
    <script>
      const artifact = ${serialized};
      const root = document.getElementById("root");

      function postMessage(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } else if (window.parent !== window) {
          window.parent.postMessage({ source: "artifact-runtime", ...payload }, "*");
        }
      }

      function renderTable(data) {
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = "<th class=\\"row-handle\\"></th><th></th>";
        data.columnOrder.forEach((columnId) => {
          const column = data.columnsById[columnId];
          const th = document.createElement("th");
          th.textContent = column?.label ?? columnId;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        data.rowOrder.forEach((rowId) => {
          const row = data.rowsById[rowId];
          if (!row) return;
          const tr = document.createElement("tr");
          tr.dataset.elementId = row.rowId;
          tr.innerHTML = "<td class=\\"row-handle\\">⋮⋮</td><td><input type=\\"checkbox\\" /></td>";
          data.columnOrder.forEach((columnId) => {
            const cell = row.cells[columnId];
            const td = document.createElement("td");
            td.textContent = cell ? String(cell.v ?? "") : "";
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
      }

      function renderDiagram(data) {
        const container = document.createElement("div");
        data.nodeOrder.forEach((nodeId) => {
          const node = data.nodesById[nodeId];
          if (!node) return;
          const nodeEl = document.createElement("div");
          nodeEl.className = "diagram-node";
          nodeEl.dataset.elementId = node.nodeId;
          nodeEl.innerHTML = "<div>" + node.data.title + "</div>";
          if (node.data.subtitle) {
            const subtitle = document.createElement("div");
            subtitle.className = "muted";
            subtitle.textContent = node.data.subtitle;
            nodeEl.appendChild(subtitle);
          }
          container.appendChild(nodeEl);
        });
        data.edgeOrder.forEach((edgeId) => {
          const edge = data.edgesById[edgeId];
          if (!edge) return;
          const edgeEl = document.createElement("div");
          edgeEl.className = "diagram-edge";
          edgeEl.dataset.elementId = edge.edgeId;
          edgeEl.textContent = edge.source + " → " + edge.target;
          container.appendChild(edgeEl);
        });
        return container;
      }

      function renderTimeline(data) {
        const container = document.createElement("div");
        data.itemOrder.forEach((itemId) => {
          const item = data.itemsById[itemId];
          if (!item) return;
          const itemEl = document.createElement("div");
          itemEl.className = "timeline-item";
          itemEl.dataset.elementId = item.itemId;
          const timeLabel = item.storyTime ? item.storyTime + " · " + item.start : item.start;
          itemEl.innerHTML = "<div>" + item.content + "</div><div class=\\"muted\\">" + timeLabel + "</div>";
          container.appendChild(itemEl);
        });
        return container;
      }

      function renderPacingChart(data) {
        const points = data.pointOrder.map((id) => data.pointsById[id]).filter(Boolean);
        const width = 320;
        const height = 180;
        const padding = 16;
        const maxX = Math.max(1, points.length - 1);
        const toX = (index) => padding + (index / maxX) * (width - padding * 2);
        const toY = (value) => padding + (1 - value) * (height - padding * 2);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        svg.classList.add("chart");
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        const pointsAttr = points.map((point, index) => {
          return toX(index) + "," + toY(point.tension);
        }).join(" ");
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("stroke", "#7c3aed");
        polyline.setAttribute("stroke-width", "2");
        polyline.setAttribute("points", pointsAttr);
        svg.appendChild(polyline);
        return svg;
      }

      function renderChart(data) {
        if (data.chartKind === "pacing") {
          return renderPacingChart(data);
        }
        const container = document.createElement("div");
        data.linkOrder.forEach((linkId) => {
          const link = data.linksById[linkId];
          if (!link) return;
          const linkEl = document.createElement("div");
          linkEl.className = "timeline-item";
          linkEl.dataset.elementId = link.linkId;
          linkEl.textContent = link.sourceId + " → " + link.targetId + " (" + link.value + ")";
          container.appendChild(linkEl);
        });
        return container;
      }

      function render() {
        root.innerHTML = "";
        if (!artifact || !artifact.type) {
          root.textContent = "Unsupported artifact.";
          return;
        }
        if (artifact.type === "table") {
          root.appendChild(renderTable(artifact.data));
          return;
        }
        if (artifact.type === "diagram") {
          root.appendChild(renderDiagram(artifact.data));
          return;
        }
        if (artifact.type === "timeline") {
          root.appendChild(renderTimeline(artifact.data));
          return;
        }
        if (artifact.type === "chart") {
          root.appendChild(renderChart(artifact.data));
          return;
        }
        root.textContent = "Unsupported artifact type.";
      }

      function focusElement(elementId) {
        if (!elementId) return;
        const el = root.querySelector("[data-element-id=\\"" + elementId + "\\"]");
        if (!el) return;
        el.classList.add("focus");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el.classList.remove("focus"), 1200);
      }

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const el = target.closest("[data-element-id]");
        if (!el) return;
        postMessage({ type: "select", elementId: el.dataset.elementId });
      });

      window.__artifactRuntimeFocus = focusElement;
      window.__artifactRuntimeExport = () => {
        postMessage({ type: "export", format: "json", payload: JSON.stringify(artifact, null, 2) });
      };

      // Listen for messages from parent (for iframe on web)
      window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "focus" && event.data.elementId) {
          focusElement(event.data.elementId);
        }
      });

      render();
      postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
}

export function ArtifactRuntimeWebView({
  artifact,
  focusId,
  onSelectElement,
}: ArtifactRuntimeWebViewProps) {
  const { colors } = useTheme();
  const webviewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const envelope = useMemo(() => {
    if (artifact.format !== "json") return null;
    try {
      return parseArtifactEnvelope(JSON.parse(artifact.content));
    } catch {
      return null;
    }
  }, [artifact.content, artifact.format]);

  const html = useMemo(() => {
    if (!envelope) return null;
    return buildArtifactHtml(envelope, {
      bg: colors.bgElevated,
      text: colors.text,
      textMuted: colors.textMuted,
      border: colors.border,
    });
  }, [colors, envelope]);

  // Handle messages from iframe on web
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.source !== "artifact-runtime") return;
      if (event.data.type === "select" && event.data.elementId && onSelectElement) {
        onSelectElement(event.data.elementId);
      }
    },
    [onSelectElement]
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Handle focus for native WebView
  useEffect(() => {
    if (Platform.OS === "web" || !focusId || !webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.__artifactRuntimeFocus && window.__artifactRuntimeFocus(${JSON.stringify(focusId)}); true;`
    );
  }, [focusId]);

  // Handle focus for web iframe
  useEffect(() => {
    if (Platform.OS !== "web" || !focusId || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: "focus", elementId: focusId }, "*");
  }, [focusId]);

  if (!envelope || !html) {
    return null;
  }

  if (Platform.OS === "web") {
    return (
      <View style={{ height: 320 }}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          style={{ width: "100%", height: "100%", border: "none" }}
          sandbox="allow-scripts allow-same-origin"
        />
      </View>
    );
  }

  return (
    <WebView
      ref={webviewRef}
      originWhitelist={["*"]}
      source={{ html }}
      style={{ height: 320 }}
      onMessage={(event) => {
        try {
          const payload = JSON.parse(event.nativeEvent.data);
          if (payload.type === "select" && payload.elementId && onSelectElement) {
            onSelectElement(payload.elementId);
          }
        } catch {
          // Ignore malformed messages.
        }
      }}
    />
  );
}
