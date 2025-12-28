import { useState, useCallback, useEffect } from "react";
import { getProjects } from "@mythos/db";
import type { Database } from "@mythos/db";

type DbProject = Database["public"]["Tables"]["projects"]["Row"];

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  updated_at: string;
  created_at: string;
}

export interface UseProjectsResult {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

function mapDbProjectToSummary(dbProject: DbProject): ProjectSummary {
  return {
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description,
    genre: dbProject.genre,
    updated_at: dbProject.updated_at,
    created_at: dbProject.created_at,
  };
}

export function useProjects(userId?: string): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const dbProjects = await getProjects(userId);
      const projectSummaries = dbProjects.map(mapDbProjectToSummary);
      setProjects(projectSummaries);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load projects";
      setError(errorMessage);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const reload = useCallback(async (): Promise<void> => {
    await loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    isLoading,
    error,
    reload,
  };
}
