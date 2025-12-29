import { getSupabaseClient, type Database } from "@mythos/db";
import type { AnalysisRecord } from "../../stores/history";
import type { SceneMetrics, SensoryBalance } from "@mythos/core";

type SceneAnalysisRow = Database["public"]["Tables"]["scene_analysis"]["Row"];
type SceneAnalysisInsert = Database["public"]["Tables"]["scene_analysis"]["Insert"];

/**
 * Input for persisting an analysis record to the database
 */
export interface PersistAnalysisInput {
  projectId: string;
  documentId?: string;
  sceneId: string;
  metrics: SceneMetrics;
  wordCount?: number;
}

/**
 * Maps database tension_data to SceneMetrics tension array
 */
function mapTensionData(tensionData: SceneAnalysisRow["tension_data"]): number[] {
  if (!tensionData) return [];

  // If overall_tension exists, create a single-element array
  if (typeof tensionData.overall_tension === "number") {
    return [tensionData.overall_tension];
  }

  // If we have a tensions array in the data, use it
  if (Array.isArray((tensionData as Record<string, unknown>)["tensions"])) {
    return (tensionData as Record<string, number[]>)["tensions"];
  }

  return [];
}

/**
 * Maps database sensory_data to SensoryBalance
 */
function mapSensoryData(sensoryData: SceneAnalysisRow["sensory_data"]): SensoryBalance {
  if (!sensoryData) {
    return { sight: 0, sound: 0, touch: 0, smell: 0, taste: 0 };
  }

  return {
    sight: (sensoryData.visual as number) ?? 0,
    sound: (sensoryData.auditory as number) ?? 0,
    touch: (sensoryData.tactile as number) ?? 0,
    smell: (sensoryData.olfactory as number) ?? 0,
    taste: (sensoryData.gustatory as number) ?? 0,
  };
}

/**
 * Maps pacing number to pacing string
 */
function mapPacing(pacing: number | null): SceneMetrics["pacing"] {
  if (pacing === null) return "steady";
  if (pacing > 60) return "accelerating";
  if (pacing < 40) return "decelerating";
  return "steady";
}

/**
 * Maps show_dont_tell_score to grade
 */
function scoreToGrade(score: number | null): string {
  if (score === null) return "C";
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 45) return "D+";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Maps database row to AnalysisRecord
 */
function mapRowToAnalysisRecord(row: SceneAnalysisRow): AnalysisRecord {
  return {
    timestamp: new Date(row.analyzed_at),
    sceneId: row.scene_id ?? row.id,
    metrics: {
      tension: mapTensionData(row.tension_data),
      sensory: mapSensoryData(row.sensory_data),
      pacing: mapPacing(row.pacing),
      mood: row.mood ?? "neutral",
      showDontTellScore: row.show_dont_tell_score ?? 50,
      showDontTellGrade: scoreToGrade(row.show_dont_tell_score),
    },
  };
}

/**
 * Fetches analysis history for a project from the database
 *
 * @param projectId - The project ID to fetch history for
 * @param limit - Maximum number of records to fetch (default: 100)
 * @returns Array of AnalysisRecord sorted by timestamp descending
 */
export async function fetchAnalysisHistory(
  projectId: string,
  limit: number = 100
): Promise<AnalysisRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("scene_analysis")
    .select("*")
    .eq("project_id", projectId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[analysisRepository] Error fetching history:", error);
    throw new Error(`Failed to fetch analysis history: ${error.message}`);
  }

  return (data as SceneAnalysisRow[]).map(mapRowToAnalysisRecord);
}

/**
 * Persists an analysis record to the database
 *
 * @param input - The analysis data to persist
 */
export async function persistAnalysisRecord(input: PersistAnalysisInput): Promise<void> {
  const { projectId, documentId, sceneId, metrics, wordCount } = input;

  // Calculate average tension for storage
  const avgTension =
    metrics.tension.length > 0
      ? metrics.tension.reduce((a, b) => a + b, 0) / metrics.tension.length
      : 50;

  // Map pacing string to numeric value
  const pacingValue =
    metrics.pacing === "accelerating" ? 70 :
    metrics.pacing === "decelerating" ? 30 : 50;

  const analysisInsert: SceneAnalysisInsert = {
    project_id: projectId,
    document_id: documentId ?? null,
    scene_id: sceneId,
    tension_data: {
      overall_tension: avgTension,
      tensions: metrics.tension,
    },
    sensory_data: {
      visual: metrics.sensory.sight,
      auditory: metrics.sensory.sound,
      tactile: metrics.sensory.touch,
      olfactory: metrics.sensory.smell,
      gustatory: metrics.sensory.taste,
      balance: Object.values(metrics.sensory).filter((v) => v > 0).length,
    },
    pacing: pacingValue,
    mood: metrics.mood,
    show_dont_tell_score: metrics.showDontTellScore,
    word_count: wordCount ?? 0,
    analyzed_at: new Date().toISOString(),
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("scene_analysis")
    .insert(analysisInsert as never);

  if (error) {
    console.error("[analysisRepository] Error persisting record:", error);
    throw new Error(`Failed to persist analysis record: ${error.message}`);
  }
}

/**
 * Fetches analysis history for a specific document
 *
 * @param projectId - The project ID
 * @param documentId - The document ID
 * @param limit - Maximum number of records to fetch
 * @returns Array of AnalysisRecord sorted by timestamp descending
 */
export async function fetchDocumentAnalysisHistory(
  projectId: string,
  documentId: string,
  limit: number = 50
): Promise<AnalysisRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("scene_analysis")
    .select("*")
    .eq("project_id", projectId)
    .eq("document_id", documentId)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[analysisRepository] Error fetching document history:", error);
    throw new Error(`Failed to fetch document analysis history: ${error.message}`);
  }

  return (data as SceneAnalysisRow[]).map(mapRowToAnalysisRecord);
}
