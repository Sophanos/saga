import { forwardRef, useEffect, useMemo, useState } from "react";
import { parseArtifactEnvelope, type ArtifactEnvelopeByType } from "@mythos/core";
import type { Artifact, ArtifactOp } from "@mythos/state";
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
  onApplyOp?: (op: ArtifactOp) => void;
}

type ProseArtifactEnvelope = Extract<
  ArtifactEnvelopeByType,
  { type: "prose" | "dialogue" | "lore" | "code" | "map" }
>;

function isProseArtifactEnvelope(envelope: ArtifactEnvelopeByType): envelope is ProseArtifactEnvelope {
  return (
    envelope.type === "prose" ||
    envelope.type === "dialogue" ||
    envelope.type === "lore" ||
    envelope.type === "code" ||
    envelope.type === "map"
  );
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
  { artifact, onApplyOp }: ArtifactRuntimeProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element | null {
  const applyArtifactOp = useArtifactStore((s) => s.applyArtifactOp);
  const applyOp = useMemo(() => {
    if (onApplyOp) return onApplyOp;
    return (op: ArtifactOp) => applyArtifactOp(artifact.id, op);
  }, [applyArtifactOp, artifact.id, onApplyOp]);
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
        onApplyOp={applyOp}
      />
    );
  }

  if (envelope.type === "diagram") {
    return (
      <ArtifactDiagram
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={applyOp}
      />
    );
  }

  if (envelope.type === "timeline") {
    return (
      <ArtifactTimeline
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={applyOp}
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

  if (isProseArtifactEnvelope(envelope)) {
    return (
      <ArtifactProse
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={applyOp}
      />
    );
  }

  if (envelope.type === "outline") {
    return (
      <ArtifactOutline
        ref={ref}
        envelope={envelope}
        focusId={focusId}
        onApplyOp={applyOp}
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
