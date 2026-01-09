/**
 * Projects hook using Convex
 */

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  updatedAt: number;
  createdAt: number;
  role?: "owner" | "editor" | "viewer";
}

export interface UseProjectsResult {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
}

export function useProjects(): UseProjectsResult {
  const projectsQuery = useQuery(api.projects.list);

  const projects: ProjectSummary[] = (projectsQuery ?? []).map((p) => ({
    id: p._id,
    name: p.name,
    description: p.description ?? null,
    genre: p.genre ?? null,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    role: p.role,
  }));

  return {
    projects,
    isLoading: projectsQuery === undefined,
    error: null,
  };
}
