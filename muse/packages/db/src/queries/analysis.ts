import { supabase } from "../client";
import type { Database } from "../types/database";

type SceneAnalysis = Database["public"]["Tables"]["scene_analysis"]["Row"];
type SceneAnalysisInsert = Database["public"]["Tables"]["scene_analysis"]["Insert"];
type SceneAnalysisUpdate = Database["public"]["Tables"]["scene_analysis"]["Update"];

/**
 * Get scene analysis records for a project, optionally filtered by document or scene
 */
export async function getSceneAnalysis(
  projectId: string,
  documentId?: string,
  sceneId?: string
): Promise<SceneAnalysis[]> {
  let query = supabase
    .from("scene_analysis")
    .select("*")
    .eq("project_id", projectId)
    .order("analyzed_at", { ascending: false });

  if (documentId) {
    query = query.eq("document_id", documentId);
  }

  if (sceneId) {
    query = query.eq("scene_id", sceneId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch scene analysis: ${error.message}`);
  }

  return (data as SceneAnalysis[]) || [];
}

/**
 * Get a single scene analysis by id
 */
export async function getSceneAnalysisById(id: string): Promise<SceneAnalysis | null> {
  const { data, error } = await supabase
    .from("scene_analysis")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch scene analysis: ${error.message}`);
  }

  return data as SceneAnalysis;
}

/**
 * Create a new scene analysis record
 */
export async function createSceneAnalysis(
  analysis: SceneAnalysisInsert
): Promise<SceneAnalysis> {
  const { data, error } = await supabase
    .from("scene_analysis")
    .insert(analysis as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create scene analysis: ${error.message}`);
  }

  return data as SceneAnalysis;
}

/**
 * Update an existing scene analysis record
 */
export async function updateSceneAnalysis(
  id: string,
  updates: SceneAnalysisUpdate
): Promise<SceneAnalysis> {
  const { data, error } = await supabase
    .from("scene_analysis")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update scene analysis: ${error.message}`);
  }

  return data as SceneAnalysis;
}

/**
 * Delete a scene analysis record
 */
export async function deleteSceneAnalysis(id: string): Promise<void> {
  const { error } = await supabase.from("scene_analysis").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete scene analysis: ${error.message}`);
  }
}

/**
 * Get the latest analysis for a project, optionally filtered by document
 * Uses the database function for efficient querying
 */
export async function getLatestAnalysis(
  projectId: string,
  documentId?: string
): Promise<SceneAnalysis[]> {
  const { data, error } = await supabase.rpc("get_latest_scene_analysis", {
    p_project_id: projectId,
    p_document_id: documentId || null,
  } as never);

  if (error) {
    throw new Error(`Failed to fetch latest analysis: ${error.message}`);
  }

  return (data as SceneAnalysis[]) || [];
}

/**
 * Get analysis history for a specific document/scene
 */
export async function getAnalysisHistory(
  projectId: string,
  documentId: string,
  sceneId?: string,
  limit: number = 10
): Promise<SceneAnalysis[]> {
  const { data, error } = await supabase.rpc("get_scene_analysis_history", {
    p_project_id: projectId,
    p_document_id: documentId,
    p_scene_id: sceneId || null,
    p_limit: limit,
  } as never);

  if (error) {
    throw new Error(`Failed to fetch analysis history: ${error.message}`);
  }

  return (data as SceneAnalysis[]) || [];
}

/**
 * Bulk create scene analysis records
 */
export async function createSceneAnalysisBatch(
  analyses: SceneAnalysisInsert[]
): Promise<SceneAnalysis[]> {
  const { data, error } = await supabase
    .from("scene_analysis")
    .insert(analyses as never[])
    .select();

  if (error) {
    throw new Error(`Failed to create scene analyses: ${error.message}`);
  }

  return (data as SceneAnalysis[]) || [];
}

/**
 * Delete all analysis records for a document
 */
export async function deleteAnalysisByDocument(documentId: string): Promise<void> {
  const { error } = await supabase
    .from("scene_analysis")
    .delete()
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Failed to delete analyses: ${error.message}`);
  }
}

/**
 * Get average metrics across all scenes in a project
 */
export async function getProjectMetrics(projectId: string): Promise<{
  avgPacing: number | null;
  avgShowDontTell: number | null;
  avgDialogueRatio: number | null;
  avgActionRatio: number | null;
  avgDescriptionRatio: number | null;
  totalWordCount: number;
  sceneCount: number;
}> {
  const { data, error } = await supabase
    .from("scene_analysis")
    .select("pacing, show_dont_tell_score, dialogue_ratio, action_ratio, description_ratio, word_count")
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to fetch project metrics: ${error.message}`);
  }

  const analyses = data as Pick<
    SceneAnalysis,
    "pacing" | "show_dont_tell_score" | "dialogue_ratio" | "action_ratio" | "description_ratio" | "word_count"
  >[];

  if (!analyses || analyses.length === 0) {
    return {
      avgPacing: null,
      avgShowDontTell: null,
      avgDialogueRatio: null,
      avgActionRatio: null,
      avgDescriptionRatio: null,
      totalWordCount: 0,
      sceneCount: 0,
    };
  }

  const sum = (arr: (number | null)[]): number =>
    arr.filter((v): v is number => v !== null).reduce((a, b) => a + b, 0);

  const count = (arr: (number | null)[]): number =>
    arr.filter((v): v is number => v !== null).length;

  const avg = (arr: (number | null)[]): number | null => {
    const validCount = count(arr);
    return validCount > 0 ? sum(arr) / validCount : null;
  };

  return {
    avgPacing: avg(analyses.map((a) => a.pacing)),
    avgShowDontTell: avg(analyses.map((a) => a.show_dont_tell_score)),
    avgDialogueRatio: avg(analyses.map((a) => a.dialogue_ratio)),
    avgActionRatio: avg(analyses.map((a) => a.action_ratio)),
    avgDescriptionRatio: avg(analyses.map((a) => a.description_ratio)),
    totalWordCount: sum(analyses.map((a) => a.word_count)),
    sceneCount: analyses.length,
  };
}
