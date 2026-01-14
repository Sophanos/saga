import { forwardRef, useEffect, useMemo, useState } from "react";
import { parseArtifactEnvelope } from "@mythos/core";
import type { Artifact } from "@mythos/state";
import { useArtifactStore } from "@mythos/state";
import { ArtifactChart } from "./ArtifactChart";
import { ArtifactDiagram } from "./ArtifactDiagram";
import { ArtifactEntityCard } from "./ArtifactEntityCard";
import { ArtifactOutline } from "./ArtifactOutline";
import { ArtifactProse } from "./ArtifactProse";
import { ArtifactTable } from "./ArtifactTable";
import { ArtifactTimeline } from "./ArtifactTimeline";

export type ArtifactExportFormat = "png" | "svg" | "json";

export interface ArtifactExportResult {
  format: ArtifactExportFormat;
  dataUrl?: string;
  json?: string;
}

export interface ArtifactRendererHandle {
  exportArtifact: (format: ArtifactExportFormat) => Promise<ArtifactExportResult | null>;
  focusElement: (elementId: string) => void;
}

export interface ArtifactRuntimeProps {
  artifact: Artifact;
}

function useArtifactFocusId(): string | null {
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    const updateHash = () => {
      if (typeof window === "undefined") return;
      const next = window.location.hash.replace(/^#/, "");
      setFocusId(next.length > 0 ? decodeURIComponent(next) : null);
    };

    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  return focusId;
}

function ArtifactRuntimeComponent(
  { artifact }: ArtifactRuntimeProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element | null {
  const applyArtifactOp = useArtifactStore((s) => s.applyArtifactOp);
  const focusId = useArtifactFocusId();

  const envelope = useMemo(() => {
    if (artifact.format !== "json") return null;
    try {
      return parseArtifactEnvelope(JSON.parse(artifact.content));
    } catch {
      return null;
    }
  }, [artifact.content, artifact.format]);

  if (!envelope) return null;

  if (envelope.type === "table") {
    return (
      <ArtifactTable
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={(op) => applyArtifactOp(artifact.id, op)}
      />
    );
  }

  if (envelope.type === "diagram") {
    return (
      <ArtifactDiagram
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={(op) => applyArtifactOp(artifact.id, op)}
      />
    );
  }

  if (envelope.type === "timeline") {
    return (
      <ArtifactTimeline
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={(op) => applyArtifactOp(artifact.id, op)}
      />
    );
  }

  if (envelope.type === "chart") {
    return (
      <ArtifactChart
        ref={ref}
        envelope={envelope}
        focusId={focusId}
      />
    );
  }

  if (envelope.type === "prose") {
    return (
      <ArtifactProse
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={(op) => applyArtifactOp(artifact.id, op)}
      />
    );
  }

  if (envelope.type === "outline") {
    return (
      <ArtifactOutline
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={(op) => applyArtifactOp(artifact.id, op)}
      />
    );
  }

  if (envelope.type === "entityCard") {
    return (
      <ArtifactEntityCard
        ref={ref}
        envelope={envelope}
        focusId={focusId}
      />
    );
  }

  return null;
}

export const ArtifactRuntime = forwardRef(ArtifactRuntimeComponent);
