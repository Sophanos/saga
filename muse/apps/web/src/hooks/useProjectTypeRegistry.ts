import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useMythosStore } from "../stores";
import type { ProjectGraphRegistryDisplay } from "@mythos/core";

export function useProjectTypeRegistry(): ProjectGraphRegistryDisplay | null {
  const projectId = useMythosStore((state) => state.project.currentProject?.id);
  const registry = useQuery(
    api.projectTypeRegistry.getResolved,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  return (registry ?? null) as ProjectGraphRegistryDisplay | null;
}
