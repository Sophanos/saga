import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useMythosStore } from "../stores";
import type { ProjectGraphRegistryDisplay } from "@mythos/core";

export function useProjectTypeRegistry(): ProjectGraphRegistryDisplay | null {
  const projectId = useMythosStore((state) => state.project.currentProject?.id);
  const registry = useQuery(
    api.projectTypeRegistry.getResolved,
    projectId ? { projectId } : "skip"
  );

  return (registry ?? null) as ProjectGraphRegistryDisplay | null;
}
