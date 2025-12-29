import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeVoidMutation,
} from "../queryHelper";
import type { Database } from "../types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export async function getProjects(userId?: string): Promise<Project[]> {
  return executeQuery<Project>(
    (client) => {
      let query = client
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      return query;
    },
    { context: "fetch projects" }
  );
}

export async function getProject(id: string): Promise<Project | null> {
  return executeSingleQuery<Project>(
    (client) => client.from("projects").select("*").eq("id", id).single(),
    { context: "fetch project" }
  );
}

export async function createProject(project: ProjectInsert): Promise<Project> {
  return executeMutation<Project>(
    (client) =>
      client
        .from("projects")
        .insert(project as never)
        .select()
        .single(),
    { context: "create project" }
  );
}

export async function updateProject(
  id: string,
  updates: ProjectUpdate
): Promise<Project> {
  return executeMutation<Project>(
    (client) =>
      client
        .from("projects")
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update project" }
  );
}

export async function deleteProject(id: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("projects").delete().eq("id", id),
    { context: "delete project" }
  );
}
