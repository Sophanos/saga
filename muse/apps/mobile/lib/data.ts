/**
 * Mobile data access (Convex migration placeholder)
 *
 * Supabase has been removed; these helpers will be wired to Convex.
 */

export type MobileProject = {
  id: string;
  name: string;
  description?: string | null;
  genre?: string | null;
  updated_at: string;
};

export type MobileDocument = {
  id: string;
  title?: string | null;
  content?: unknown;
  type?: string | null;
  updated_at?: string | null;
};

export type MobileEntity = {
  id: string;
  name: string;
  type: string;
};

export async function listProjects(_userId: string): Promise<MobileProject[]> {
  return [];
}

export async function getProject(projectId: string): Promise<MobileProject | null> {
  return {
    id: projectId,
    name: "Untitled Project",
    description: null,
    updated_at: new Date().toISOString(),
  };
}

export async function listDocuments(_projectId: string): Promise<MobileDocument[]> {
  return [];
}

export async function listEntities(options: {
  userId: string;
  projectId?: string;
}): Promise<{ entities: MobileEntity[]; projectName: string | null }> {
  void options;
  return { entities: [], projectName: null };
}
