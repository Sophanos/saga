import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { FolderPlus, Feather, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { Button, Input, FormField, TextArea } from "@mythos/ui";
import { useProgressiveStore } from "@mythos/state";
import type { TemplateDraft } from "@mythos/agent-protocol";
import { PROJECT_TYPE_DEFS, type ProjectType } from "./projectTypes";
import { useAuthStore } from "../../../stores/auth";

interface CreateProjectFormProps {
  projectType: ProjectType;
  /** Optional AI-generated template draft */
  templateDraft?: TemplateDraft;
  creationMode: "gardener" | "architect";
  onCreated: (projectId: string) => void;
  onClose: () => void;
}

export function CreateProjectForm({
  projectType,
  templateDraft,
  creationMode: initialMode,
  onCreated,
  onClose,
}: CreateProjectFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creationMode, setCreationMode] = useState(initialMode);
  const [showDetails, setShowDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = useAuthStore((state) => state.user?.id);
  const bootstrapProject = useMutation(api.projectBootstrap.bootstrap);

  const projectTypeDef = PROJECT_TYPE_DEFS[projectType];
  const isAIGenerated = !!templateDraft;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || isSubmitting) return;

      setIsSubmitting(true);
      setError(null);

      try {
        if (!userId) {
          throw new Error("Please sign in to create a project.");
        }

        const result = await bootstrapProject({
          name: name.trim(),
          description: description.trim() || undefined,
          templateId: projectTypeDef.baseTemplateId,
          initialDocumentType: templateDraft?.documentKinds?.[0]?.kind ?? "chapter",
          initialDocumentTitle: projectType === "story" ? "Chapter 1" : "Untitled",
          seed: templateDraft
            ? {
                kind: "template" as const,
                projectName: name.trim(),
                projectDescription: description.trim() || undefined,
                templateId: templateDraft.baseTemplateId ?? projectTypeDef.baseTemplateId,
                templateName: templateDraft.name,
                templateDescription: templateDraft.description,
                entityKinds: templateDraft.entityKinds.map((k) => k.label),
                relationshipKinds: templateDraft.relationshipKinds.map((k) => k.label),
              }
            : {
                kind: "blank" as const,
                projectName: name.trim(),
                projectDescription: description.trim() || undefined,
              },
          templateEntityKinds: templateDraft?.entityKinds,
          templateRelationshipKinds: templateDraft?.relationshipKinds,
        });

        // Initialize progressive state
        const progressive = useProgressiveStore.getState();
        progressive.ensureProject(result.projectId, {
          creationMode,
          phase: creationMode === "gardener" ? 1 : 4,
          entityMentionCounts: {},
          unlockedModules:
            creationMode === "gardener"
              ? { editor: true }
              : { editor: true, manifest: true, console: true, project_graph: true },
          totalWritingTimeSec: 0,
          neverAsk: {},
        });

        progressive.setActiveProject(result.projectId);
        onCreated(result.projectId);
      } catch (err) {
        console.error("Failed to create project:", err);
        setError(err instanceof Error ? err.message : "Failed to create project");
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, description, projectType, projectTypeDef, templateDraft, creationMode, isSubmitting, onCreated, userId, bootstrapProject]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Template Summary */}
      <div className="p-4 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-mythos-accent-primary/10 text-mythos-accent-primary">
            <projectTypeDef.icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-mythos-text-primary">
              {isAIGenerated ? templateDraft.name : projectTypeDef.label}
            </h3>
            <p className="text-xs text-mythos-text-muted">
              {isAIGenerated ? templateDraft.description : projectTypeDef.description}
            </p>
          </div>
        </div>

        {/* Collapsible Details for AI-generated templates */}
        {isAIGenerated && templateDraft && (
          <div className="mt-3 pt-3 border-t border-mythos-text-muted/10">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-mythos-text-muted hover:text-mythos-text-secondary transition-colors"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? "Hide details" : "Show what's included"}
            </button>

            {showDetails && (
              <div className="mt-3 space-y-2 text-xs">
                <div>
                  <span className="text-mythos-text-muted">Entity Types: </span>
                  <span className="text-mythos-text-secondary">
                    {templateDraft.entityKinds.map((e) => e.label).join(", ")}
                  </span>
                </div>
                <div>
                  <span className="text-mythos-text-muted">Relationships: </span>
                  <span className="text-mythos-text-secondary">
                    {templateDraft.relationshipKinds.slice(0, 5).map((r) => r.label).join(", ")}
                    {templateDraft.relationshipKinds.length > 5 && ` +${templateDraft.relationshipKinds.length - 5} more`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Name */}
      <FormField label="Project Name" required>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter project name..."
          autoFocus
          disabled={isSubmitting}
        />
      </FormField>

      {/* Creation Mode Toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-mythos-text-primary">
          How do you want to start?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCreationMode("gardener")}
            disabled={isSubmitting}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              creationMode === "gardener"
                ? "border-mythos-accent-primary bg-mythos-accent-primary/10"
                : "border-mythos-border-default hover:border-mythos-text-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Feather
                className={`w-4 h-4 ${
                  creationMode === "gardener" ? "text-mythos-accent-primary" : "text-mythos-text-muted"
                }`}
              />
              <span
                className={`font-medium text-sm ${
                  creationMode === "gardener" ? "text-mythos-text-primary" : "text-mythos-text-secondary"
                }`}
              >
                Start Writing
              </span>
            </div>
            <p className="text-xs text-mythos-text-muted">
              Discover your world as you write
            </p>
          </button>
          <button
            type="button"
            onClick={() => setCreationMode("architect")}
            disabled={isSubmitting}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              creationMode === "architect"
                ? "border-mythos-accent-purple bg-mythos-accent-purple/10"
                : "border-mythos-border-default hover:border-mythos-text-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Building2
                className={`w-4 h-4 ${
                  creationMode === "architect" ? "text-mythos-accent-purple" : "text-mythos-text-muted"
                }`}
              />
              <span
                className={`font-medium text-sm ${
                  creationMode === "architect" ? "text-mythos-text-primary" : "text-mythos-text-secondary"
                }`}
              >
                Build Your World
              </span>
            </div>
            <p className="text-xs text-mythos-text-muted">
              Set up your world structure first
            </p>
          </button>
        </div>
      </div>

      {/* Description (optional) */}
      <FormField label="Description">
        <TextArea
          value={description}
          onChange={setDescription}
          placeholder="A brief description of your project..."
          rows={2}
          disabled={isSubmitting}
        />
      </FormField>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-md bg-mythos-accent-red/10 border border-mythos-accent-red/30">
          <p className="text-sm text-mythos-accent-red">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSubmitting} className="gap-1.5">
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <FolderPlus className="w-4 h-4" />
              Create Project
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
