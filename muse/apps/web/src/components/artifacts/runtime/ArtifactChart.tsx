import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as echarts from "echarts";
import type { ECharts } from "echarts";
import type { ArtifactEnvelopeByType } from "@mythos/core";
import type { ArtifactRendererHandle, ArtifactExportResult } from "./ArtifactRuntime";

interface ArtifactChartProps {
  envelope: Extract<ArtifactEnvelopeByType, { type: "chart" }>;
  focusId: string | null;
}

function ArtifactChartComponent(
  { envelope, focusId }: ArtifactChartProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  const option = useMemo(() => {
    if (envelope.data.chartKind === "pacing") {
      const points = envelope.data.pointOrder.map((id) => envelope.data.pointsById[id]);
      return {
        xAxis: { type: "category", data: points.map((point) => point.label ?? point.pointId) },
        yAxis: { type: "value", min: 0, max: 1 },
        series: [
          {
            type: "line",
            data: points.map((point) => point.tension),
            smooth: true,
          },
        ],
      };
    }

    const nodes = envelope.data.nodeOrder.map((id) => envelope.data.nodesById[id]);
    const links = envelope.data.linkOrder.map((id) => envelope.data.linksById[id]);
    return {
      series: [
        {
          type: "sankey",
          data: nodes.map((node) => ({ name: node.label })),
          links: links.map((link) => ({
            source: envelope.data.nodesById[link.sourceId]?.label ?? link.sourceId,
            target: envelope.data.nodesById[link.targetId]?.label ?? link.targetId,
            value: link.value,
          })),
          emphasis: { focus: "adjacency" },
        },
      ],
    };
  }, [envelope.data]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    chart.setOption(option);
    return () => {
      chart.dispose();
    };
  }, [option]);

  useEffect(() => {
    if (!focusId || !chartRef.current) return;
    if (envelope.data.chartKind === "pacing") {
      const index = envelope.data.pointOrder.indexOf(focusId);
      if (index >= 0) {
        chartRef.current.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: index });
      }
      return;
    }
    if (envelope.data.chartKind === "influenceSankey") {
      const node = envelope.data.nodesById[focusId];
      if (node) {
        chartRef.current.dispatchAction({
          type: "highlight",
          seriesIndex: 0,
          name: node.label,
        });
        return;
      }
      const linkIndex = envelope.data.linkOrder.indexOf(focusId);
      if (linkIndex >= 0) {
        chartRef.current.dispatchAction({
          type: "highlight",
          seriesIndex: 0,
          dataType: "edge",
          dataIndex: linkIndex,
        });
      }
    }
  }, [envelope.data, focusId]);

  const handleExport = useCallback(
    async (format: "png" | "svg" | "json"): Promise<ArtifactExportResult | null> => {
      if (format === "json") {
        return { format: "json", json: JSON.stringify(envelope, null, 2) };
      }
      if (!chartRef.current) return null;
      const dataUrl = chartRef.current.getDataURL({ type: "png", pixelRatio: 2 });
      return { format: "png", dataUrl };
    },
    [envelope]
  );

  const handleFocus = useCallback(
    (elementId: string) => {
      if (envelope.data.chartKind === "pacing") {
        const index = envelope.data.pointOrder.indexOf(elementId);
        if (index >= 0) {
          chartRef.current?.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: index });
        }
        return;
      }
      if (envelope.data.chartKind === "influenceSankey") {
        const node = envelope.data.nodesById[elementId];
        if (node) {
          chartRef.current?.dispatchAction({
            type: "highlight",
            seriesIndex: 0,
            name: node.label,
          });
          return;
        }
        const linkIndex = envelope.data.linkOrder.indexOf(elementId);
        if (linkIndex >= 0) {
          chartRef.current?.dispatchAction({
            type: "highlight",
            seriesIndex: 0,
            dataType: "edge",
            dataIndex: linkIndex,
          });
        }
      }
    },
    [envelope.data]
  );

  useImperativeHandle(ref, () => ({
    exportArtifact: handleExport,
    focusElement: handleFocus,
  }), [handleExport, handleFocus]);

  return (
    <div
      ref={containerRef}
      className="h-[320px] w-full rounded-lg border border-mythos-border-default bg-mythos-bg-secondary"
    />
  );
}

export const ArtifactChart = forwardRef(ArtifactChartComponent);
