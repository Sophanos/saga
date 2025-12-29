import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeBulkMutation,
  executeVoidMutation,
  executeRpc,
} from "../queryHelper";
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
  return executeQuery<SceneAnalysis>(
    (client) => {
      let query = client
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

      return query;
    },
    { context: "fetch scene analysis" }
  );
}

/**
 * Get a single scene analysis by id
 */
export async function getSceneAnalysisById(id: string): Promise<SceneAnalysis | null> {
  return executeSingleQuery<SceneAnalysis>(
    (client) =>
      client
        .from("scene_analysis")
        .select("*")
        .eq("id", id)
        .single(),
    { context: "fetch scene analysis" }
  );
}

/**
 * Create a new scene analysis record
 */
export async function createSceneAnalysis(
  analysis: SceneAnalysisInsert
): Promise<SceneAnalysis> {
  return executeMutation<SceneAnalysis>(
    (client) =>
      client
        .from("scene_analysis")
        .insert(analysis as never)
        .select()
        .single(),
    { context: "create scene analysis" }
  );
}

/**
 * Update an existing scene analysis record
 */
export async function updateSceneAnalysis(
  id: string,
  updates: SceneAnalysisUpdate
): Promise<SceneAnalysis> {
  return executeMutation<SceneAnalysis>(
    (client) =>
      client
        .from("scene_analysis")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update scene analysis" }
  );
}

/**
 * Delete a scene analysis record
 */
export async function deleteSceneAnalysis(id: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("scene_analysis").delete().eq("id", id),
    { context: "delete scene analysis" }
  );
}

/**
 * Get the latest analysis for a project, optionally filtered by document
 * Uses the database function for efficient querying
 */
export async function getLatestAnalysis(
  projectId: string,
  documentId?: string
): Promise<SceneAnalysis[]> {
  return executeRpc<SceneAnalysis[]>(
    (client) =>
      client.rpc("get_latest_scene_analysis", {
        p_project_id: projectId,
        p_document_id: documentId || null,
      } as never),
    { context: "fetch latest analysis" }
  );
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
  return executeRpc<SceneAnalysis[]>(
    (client) =>
      client.rpc("get_scene_analysis_history", {
        p_project_id: projectId,
        p_document_id: documentId,
        p_scene_id: sceneId || null,
        p_limit: limit,
      } as never),
    { context: "fetch analysis history" }
  );
}

/**
 * Bulk create scene analysis records
 */
export async function createSceneAnalysisBatch(
  analyses: SceneAnalysisInsert[]
): Promise<SceneAnalysis[]> {
  return executeBulkMutation<SceneAnalysis>(
    (client) =>
      client
        .from("scene_analysis")
        .insert(analyses as never[])
        .select(),
    { context: "create scene analyses" }
  );
}

/**
 * Delete all analysis records for a document
 */
export async function deleteAnalysisByDocument(documentId: string): Promise<void> {
  return executeVoidMutation(
    (client) =>
      client
        .from("scene_analysis")
        .delete()
        .eq("document_id", documentId),
    { context: "delete analyses" }
  );
}

/**
 * Project metrics return type
 */
export interface ProjectMetrics {
  avgPacing: number | null;
  avgShowDontTell: number | null;
  avgDialogueRatio: number | null;
  avgActionRatio: number | null;
  avgDescriptionRatio: number | null;
  totalWordCount: number;
  sceneCount: number;
}

/**
 * Get average metrics across all scenes in a project
 * Uses SQL aggregation via database function for efficiency
 */
export async function getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
  const metrics = await executeRpc<ProjectMetrics | null>(
    (client) =>
      client.rpc("get_project_metrics", {
        p_project_id: projectId,
      } as never),
    { context: "fetch project metrics" }
  );

  // Handle empty result (no scenes analyzed yet)
  if (!metrics || metrics.sceneCount === 0) {
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

  return metrics;
}

/*
 * DEPRECATED: Old JavaScript-based aggregation (kept for reference)
 * This implementation fetched ALL rows then aggregated client-side,
 * which was inefficient for large projects.
 *
 * async function getProjectMetricsLegacy(projectId: string): Promise<ProjectMetrics> {
 *   const supabase = getSupabaseClient();
 *   const { data, error } = await supabase
 *     .from("scene_analysis")
 *     .select("pacing, show_dont_tell_score, dialogue_ratio, action_ratio, description_ratio, word_count")
 *     .eq("project_id", projectId);
 *
 *   if (error) throw DBError.fromSupabaseError(error, "fetch project metrics");
 *
 *   const analyses = data as Pick<SceneAnalysis, ...>[];
 *   if (!analyses || analyses.length === 0) return defaultMetrics;
 *
 *   // JavaScript aggregation loop - replaced by SQL AVG/SUM/COUNT
 *   const sum = (arr: (number | null)[]) => arr.filter(v => v !== null).reduce((a, b) => a + b, 0);
 *   const avg = (arr: (number | null)[]) => { ... };
 *   return { avgPacing: avg(analyses.map(a => a.pacing)), ... };
 * }
 */
