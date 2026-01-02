import { useState, useCallback } from "react";
import { FolderPlus, Feather, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { Button, Input, FormField, TextArea } from "@mythos/ui";
import { createProject, createDocument } from "@mythos/db";
import { useProgressiveStore } from "@mythos/state";
import type { ProjectTemplate } from "@mythos/core";
import { getTemplateIcon } from "../../../utils/templateIcons";

interface CreateProjectFormProps {
  template: ProjectTemplate;
  creationMode: "gardener" | "architect";
  onCreated: (projectId: string) => void;
  onClose: () => void;
}

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function CreateProjectForm({
  template,
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || isSubmitting) return;

      setIsSubmitting(true);
      setError(null);

      try {
        // Create the project with template config
        // Cast to Record<string, unknown>[] to match DB type
        const project = await createProject({
          name: name.trim(),
          description: description.trim() || null,
          genre: template.defaultGenre,
          template_id: template.id,
          entity_kinds_config: template.entityKinds as unknown as Record<string, unknown>[],
          relationship_kinds_config: template.relationshipKinds as unknown as Record<string, unknown>[],
        });

        // Create an initial empty document
        await createDocument({
          project_id: project.id,
          type: template.defaultDocumentKind || "chapter",
          title: "Chapter 1",
          content: EMPTY_TIPTAP_DOC,
          content_text: "",
          order_index: 0,
          word_count: 0,
        });

        // Initialize progressive state
        const progressive = useProgressiveStore.getState();
        progressive.ensureProject(project.id, {
          creationMode,
          phase: creationMode === "gardener" ? 1 : 4,
          entityMentionCounts: {},
          unlockedModules:
            creationMode === "gardener"
              ? { editor: true }
              : { editor: true, manifest: true, console: true, world_graph: true },
          totalWritingTimeSec: 0,
          neverAsk: {},
        });

        progressive.setActiveProject(project.id);
        onCreated(project.id);
      } catch (err) {
        console.error("Failed to create project:", err);
        setError(err instanceof Error ? err.message : "Failed to create project");
        setIsSubmitting(false);
      }
    },
    [name, description, template, creationMode, isSubmitting, onCreated]
  );

  const isBlank = template.id === "blank";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Template Summary */}
      <div className="p-4 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-mythos-accent-primary/10 text-mythos-accent-primary">
            {getTemplateIcon(template.icon)}
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-mythos-text-primary">{template.name}</h3>
            <p className="text-xs text-mythos-text-muted">{template.description}</p>
          </div>
        </div>

        {/* Collapsible Details */}
        {!isBlank && (
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
                    {template.entityKinds.map((e) => e.label).join(", ")}
                  </span>
                </div>
                <div>
                  <span className="text-mythos-text-muted">Relationships: </span>
                  <span className="text-mythos-text-secondary">
                    {template.relationshipKinds.slice(0, 5).map((r) => r.label).join(", ")}
                    {template.relationshipKinds.length > 5 && ` +${template.relationshipKinds.length - 5} more`}
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
