import { useMemo } from "react";
import { cn } from "@mythos/ui";
import type { Artifact, ArtifactOp, ArtifactSplitMode } from "@mythos/state";
import { parseArtifactEnvelope } from "@mythos/core";
import { ArtifactRuntime } from "./runtime/ArtifactRuntime";
import { DiffView, InlineDiffView } from "../console/DiffViews";

export function ArtifactSplitView({
  left,
  right,
  mode,
  onApplyOp,
}: {
  left: Artifact;
  right: Artifact;
  mode: ArtifactSplitMode;
  onApplyOp?: (artifactId: string, op: ArtifactOp) => void;
}): JSX.Element {
  const leftHasEnvelope = useMemo(() => {
    if (left.format !== "json") return false;
    try {
      parseArtifactEnvelope(JSON.parse(left.content));
      return true;
    } catch {
      return false;
    }
  }, [left.content, left.format]);

  const rightHasEnvelope = useMemo(() => {
    if (right.format !== "json") return false;
    try {
      parseArtifactEnvelope(JSON.parse(right.content));
      return true;
    } catch {
      return false;
    }
  }, [right.content, right.format]);

  if (mode === "before-after") {
    return <DiffView before={left.content} after={right.content} />;
  }

  if (mode === "inline") {
    return <InlineDiffView before={left.content} after={right.content} />;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-mythos-text-muted truncate">{left.title}</div>
          <div className="text-[11px] text-mythos-text-muted/70">{left.status}</div>
        </div>
        <div className={cn("rounded-lg border border-mythos-border-default bg-mythos-bg-tertiary/30", "p-3")}>
          {leftHasEnvelope ? (
            <ArtifactRuntime
              artifact={left}
              onApplyOp={
                onApplyOp ? (op) => onApplyOp(left.id, op) : undefined
              }
            />
          ) : (
            <pre className="text-xs font-mono text-mythos-text-primary whitespace-pre-wrap">
              {left.content}
            </pre>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-mythos-text-muted truncate">{right.title}</div>
          <div className="text-[11px] text-mythos-text-muted/70">{right.status}</div>
        </div>
        <div className={cn("rounded-lg border border-mythos-border-default bg-mythos-bg-tertiary/30", "p-3")}>
          {rightHasEnvelope ? (
            <ArtifactRuntime
              artifact={right}
              onApplyOp={
                onApplyOp ? (op) => onApplyOp(right.id, op) : undefined
              }
            />
          ) : (
            <pre className="text-xs font-mono text-mythos-text-primary whitespace-pre-wrap">
              {right.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

