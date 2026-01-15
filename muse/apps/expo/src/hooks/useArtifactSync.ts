import { useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  useArtifactStore,
  useProjectStore,
  type Artifact,
  type ArtifactStatus,
  type ArtifactType,
} from "@mythos/state";

type ArtifactDoc = Doc<"artifacts">;

function resolveArtifactFormat(artifact: ArtifactDoc): Artifact["format"] {
  if (artifact.format === "json") return "json";
  if (artifact.format === "plain") return "plain";
  return "markdown";
}

function mapServerArtifact(artifact: ArtifactDoc): Artifact {
  const id = artifact.artifactKey ?? artifact._id;
  const versionId = `v-${artifact.updatedAt}`;

  return {
    id,
    type: artifact.type as ArtifactType,
    title: artifact.title,
    content: artifact.content,
    format: resolveArtifactFormat(artifact),
    status: artifact.status as ArtifactStatus,
    iterationHistory: [],
    versions: [
      {
        id: versionId,
        content: artifact.content,
        timestamp: artifact.updatedAt,
        trigger: "creation",
      },
    ],
    currentVersionId: versionId,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
    projectId: artifact.projectId,
    createdBy: artifact.createdBy,
    sources: artifact.sources,
    executionContext: artifact.executionContext as any,
    validationErrors: [],
    opLog: [],
  };
}

export function useArtifactSync(): void {
  const projectId = useProjectStore((s) => s.currentProjectId);

  const artifacts = useQuery(
    (api as any).artifacts.list,
    projectId ? { projectId: projectId as Id<"projects">, limit: 200 } : "skip"
  ) as ArtifactDoc[] | undefined;

  const mapped = useMemo(() => {
    if (!artifacts) return null;
    return artifacts.map(mapServerArtifact);
  }, [artifacts]);

  useEffect(() => {
    if (!mapped) return;
    useArtifactStore.getState().upsertArtifacts(mapped);
  }, [mapped]);
}
