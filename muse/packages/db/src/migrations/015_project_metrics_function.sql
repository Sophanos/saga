-- Migration 015: Project Metrics Aggregation Function
-- Provides efficient SQL-based aggregation for project metrics
-- Replaces JavaScript-side aggregation for better performance on large projects

-- Function to get aggregated project metrics
-- Returns averaged metrics across all scene analyses for a project
CREATE OR REPLACE FUNCTION get_project_metrics(p_project_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'avgPacing', AVG(pacing),
    'avgShowDontTell', AVG(show_dont_tell_score),
    'avgDialogueRatio', AVG(dialogue_ratio),
    'avgActionRatio', AVG(action_ratio),
    'avgDescriptionRatio', AVG(description_ratio),
    'totalWordCount', COALESCE(SUM(word_count), 0),
    'sceneCount', COUNT(*)
  )
  FROM scene_analysis
  WHERE project_id = p_project_id;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_project_metrics(UUID) IS
  'Aggregates scene analysis metrics for a project. Returns JSON with averages for pacing, show-dont-tell, dialogue/action/description ratios, plus total word count and scene count.';
