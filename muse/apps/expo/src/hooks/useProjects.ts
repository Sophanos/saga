/**
 * useProjects - Hook to fetch user's projects from Convex
 *
 * Returns sorted list of projects by last updated
 */

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';

export interface Project {
  id: Id<'projects'>;
  name: string;
  description?: string;
  templateId?: string;
  createdAt: number;
  updatedAt: number;
  role?: 'owner' | 'editor' | 'viewer';
}

export function useProjects() {
  const projectsQuery = useQuery(api.projects.list);

  const projects = useMemo(() => {
    if (!projectsQuery) return [];

    return projectsQuery
      .map((p): Project => ({
        id: p._id,
        name: p.name,
        description: p.description,
        templateId: p.templateId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        role: p.role,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projectsQuery]);

  return {
    projects,
    isLoading: projectsQuery === undefined,
    error: null, // Convex throws on error, doesn't return it
  };
}

export function useProjectCount() {
  const { projects, isLoading } = useProjects();
  return { count: projects.length, isLoading };
}
