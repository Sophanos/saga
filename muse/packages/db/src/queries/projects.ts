import { supabase } from "../client";
import type { Database } from "../types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export async function getProjects(userId?: string): Promise<Project[]> {
  let query = supabase.from("projects").select("*").order("updated_at", { ascending: false });

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }

  return (data as Project[]) || [];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw new Error(`Failed to fetch project: ${error.message}`);
  }

  return data as Project;
}

export async function createProject(project: ProjectInsert): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return data as Project;
}

export async function updateProject(
  id: string,
  updates: ProjectUpdate
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update project: ${error.message}`);
  }

  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}
