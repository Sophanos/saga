export type WidgetExecutionStatus =
  | "idle"
  | "gathering"
  | "clarifying"
  | "generating"
  | "formatting"
  | "preview"
  | "applying"
  | "done"
  | "error";

export interface WidgetInvokeRequest {
  widgetId: string;
  projectId: string;
  documentId?: string;
  selectionText?: string;
  selectionRange?: { from: number; to: number };
  parameters?: Record<string, unknown>;
}

export type ArtifactSourceType = "document" | "entity" | "memory";

export interface ArtifactSourceRef {
  type: ArtifactSourceType;
  id: string;
  title?: string;
  manual: boolean;
  addedAt: number;
  sourceUpdatedAt?: number;
}

export interface ArtifactManifestDraft {
  type: string;
  status: "draft" | "manually_modified";
  sources: ArtifactSourceRef[];
  createdBy: string;
  createdAt: number;
  executionContext: {
    widgetId: string;
    widgetVersion: string;
    model: string;
    inputs: Record<string, unknown>;
    startedAt: number;
    completedAt?: number;
  };
}

export interface WidgetExecutionResult {
  executionId: string;
  widgetId: string;
  widgetType: "inline" | "artifact";
  model: string;
  output: string;
  titleSuggestion?: string;
  manifestDraft?: ArtifactManifestDraft;
}
