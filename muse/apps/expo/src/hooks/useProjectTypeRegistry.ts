import { useQuery } from 'convex/react';
import type { ProjectGraphRegistryDisplay } from '@mythos/core';
import { useProjectStore } from '@mythos/state';
import { api } from '../../../../convex/_generated/api';

export function useProjectTypeRegistry(): ProjectGraphRegistryDisplay | null {
  const projectId = useProjectStore((state) => state.currentProjectId);

  const registry = useQuery(
    // Convex API types are too deep for expo typecheck; treat as untyped.
    // @ts-ignore
    api.projectTypeRegistry.getResolved as any,
    projectId ? { projectId } : ('skip' as any)
  ) as ProjectGraphRegistryDisplay | undefined;

  return registry ?? null;
}
