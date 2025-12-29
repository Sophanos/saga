import { getSupabaseClient } from "../client";

// Local type definitions (table not yet in generated Database types)
export interface Capture {
  id: string;
  project_id: string;
  created_by: string;
  kind: "text" | "voice" | "photo" | "flag" | "chat_plan";
  status: "inbox" | "processed" | "archived";
  title: string | null;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  payload: Record<string, unknown>;
  source: "mobile" | "web";
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export type CaptureInsert = Omit<Capture, "id" | "created_at" | "updated_at">;
export type CaptureUpdate = Partial<Omit<Capture, "id" | "project_id" | "created_by" | "created_at">>;

/**
 * Get all captures for a project
 */
export async function getCaptures(projectId: string): Promise<Capture[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch captures: ${error.message}`);
  }

  return (data as Capture[]) || [];
}

/**
 * Get a single capture by id
 */
export async function getCapture(id: string): Promise<Capture | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch capture: ${error.message}`);
  }

  return data as Capture;
}

/**
 * Get captures by status for a project
 */
export async function getCapturesByStatus(
  projectId: string,
  status: Capture["status"]
): Promise<Capture[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch captures by status: ${error.message}`);
  }

  return (data as Capture[]) || [];
}

/**
 * Get captures by kind for a project
 */
export async function getCapturesByKind(
  projectId: string,
  kind: Capture["kind"]
): Promise<Capture[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .select("*")
    .eq("project_id", projectId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch captures by kind: ${error.message}`);
  }

  return (data as Capture[]) || [];
}

/**
 * Create a new capture
 */
export async function createCapture(capture: CaptureInsert): Promise<Capture> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .insert(capture as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create capture: ${error.message}`);
  }

  return data as Capture;
}

/**
 * Update an existing capture
 */
export async function updateCapture(
  id: string,
  updates: CaptureUpdate
): Promise<Capture> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update capture: ${error.message}`);
  }

  return data as Capture;
}

/**
 * Update capture status (convenience method)
 */
export async function updateCaptureStatus(
  id: string,
  status: Capture["status"]
): Promise<Capture> {
  const supabase = getSupabaseClient();

  // If marking as processed, also set processed_at
  const updates: CaptureUpdate = { status };
  if (status === "processed") {
    updates.processed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("captures")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update capture status: ${error.message}`);
  }

  return data as Capture;
}

/**
 * Delete a capture
 */
export async function deleteCapture(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("captures").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete capture: ${error.message}`);
  }
}

/**
 * Get inbox captures for a project (status = 'inbox')
 */
export async function getInboxCaptures(projectId: string): Promise<Capture[]> {
  return getCapturesByStatus(projectId, "inbox");
}

/**
 * Bulk create captures
 */
export async function createCaptures(
  captures: CaptureInsert[]
): Promise<Capture[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("captures")
    .insert(captures as never[])
    .select();

  if (error) {
    throw new Error(`Failed to create captures: ${error.message}`);
  }

  return (data as Capture[]) || [];
}

/**
 * Delete all captures for a project
 */
export async function deleteCapturesByProject(projectId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("captures")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete captures: ${error.message}`);
  }
}
